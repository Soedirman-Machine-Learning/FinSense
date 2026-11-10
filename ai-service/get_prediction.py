"""
FinSense AI — get_prediction.py
=================================
Capstone CC26-PSU282 | Coding Camp 2026 powered by DBS Foundation

Script inferensi untuk 3 model prediksi FinSense (versi final).
Disesuaikan dengan model hasil training terakhir:
  - Revenue Forecaster  : LSTM + AttentionLayer, 17 fitur (incl. IsHoliday, IsRamadan, dll)
  - Product Classifier  : Binary classifier top-5 produk
  - Stock Classifier    : Bidirectional LSTM + Focal Loss + SMOTE, threshold optimal 0.45

Cara pakai:
    python get_prediction.py

Atau import fungsinya di Express backend via child_process / subprocess.

Requirements:
    pip install tensorflow scikit-learn pandas numpy holidays
"""

import pickle
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ── Install holidays jika belum ada ──────────────────────────
try:
    import holidays
except ImportError:
    import subprocess
    subprocess.run(['pip', 'install', 'holidays', '-q'])
    import holidays

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model


# ══════════════════════════════════════════════════════════════
# RE-DEFINISI CUSTOM CLASS
# Wajib ada agar model .keras bisa di-load ulang
# ══════════════════════════════════════════════════════════════

class AttentionLayer(layers.Layer):
    """Custom Attention Layer untuk time-series weighting."""
    def __init__(self, units, **kwargs):
        super().__init__(**kwargs)
        self.units = units
        self.W = layers.Dense(units, use_bias=False)
        self.V = layers.Dense(1,     use_bias=False)

    def call(self, inputs):
        score       = tf.nn.tanh(self.W(inputs))
        attention_w = tf.nn.softmax(self.V(score), axis=1)
        context     = tf.reduce_sum(attention_w * inputs, axis=1)
        return context, attention_w

    def get_config(self):
        config = super().get_config()
        config.update({'units': self.units})
        return config


class WeightedMAE(keras.losses.Loss):
    """Custom Loss: weighted MAE."""
    def __init__(self, under_penalty=1.5, **kwargs):
        super().__init__(**kwargs)
        self.under_penalty = under_penalty

    def call(self, y_true, y_pred):
        diff   = y_true - y_pred
        weight = tf.where(diff > 0,
                          tf.ones_like(diff) * self.under_penalty,
                          tf.ones_like(diff))
        return tf.reduce_mean(weight * tf.abs(diff))

    def get_config(self):
        config = super().get_config()
        config.update({'under_penalty': self.under_penalty})
        return config


class StockPredictor(Model):
    """Model Subclassing: Bidirectional LSTM + AttentionLayer."""
    def __init__(self, window, n_features, **kwargs):
        super().__init__(**kwargs)
        self.window     = window
        self.n_features = n_features
        reg = keras.regularizers.l2(1e-4)
        self.bilstm1 = layers.Bidirectional(
            layers.LSTM(64, return_sequences=True,
                        kernel_regularizer=reg,
                        recurrent_regularizer=reg),
            name='bilstm_1'
        )
        self.drop1   = layers.Dropout(0.3)
        self.bilstm2 = layers.Bidirectional(
            layers.LSTM(32, return_sequences=True,
                        kernel_regularizer=reg),
            name='bilstm_2'
        )
        self.attn    = AttentionLayer(64, name='stock_attention')
        self.bn1     = layers.BatchNormalization()
        self.dense1  = layers.Dense(64, activation='relu', kernel_regularizer=reg)
        self.drop2   = layers.Dropout(0.3)
        self.dense2  = layers.Dense(32, activation='relu', kernel_regularizer=reg)
        self.out     = layers.Dense(1, activation='sigmoid', name='restock_prob')

    def call(self, inputs, training=False):
        x          = self.bilstm1(inputs)
        x          = self.drop1(x, training=training)
        x          = self.bilstm2(x)
        context, _ = self.attn(x)
        x          = self.bn1(context, training=training)
        x          = self.dense1(x)
        x          = self.drop2(x, training=training)
        x          = self.dense2(x)
        return self.out(x)

    def get_config(self):
        return {'window': self.window, 'n_features': self.n_features, 'name': self.name}


def focal_loss(gamma=2.0, alpha=0.25):
    """Focal Loss untuk class imbalance."""
    def loss_fn(y_true, y_pred):
        y_pred  = tf.clip_by_value(y_pred, 1e-7, 1 - 1e-7)
        bce     = -y_true * tf.math.log(y_pred) - (1 - y_true) * tf.math.log(1 - y_pred)
        p_t     = y_true * y_pred + (1 - y_true) * (1 - y_pred)
        alpha_t = y_true * alpha + (1 - y_true) * (1 - alpha)
        focal   = alpha_t * tf.pow(1 - p_t, gamma) * bce
        return tf.reduce_mean(focal)
    return loss_fn


CUSTOM_OBJECTS = {
    'AttentionLayer': AttentionLayer,
    'WeightedMAE'   : WeightedMAE,
    'StockPredictor': StockPredictor,
    'loss_fn'       : focal_loss(),
}


# ══════════════════════════════════════════════════════════════
# LOAD MODEL & SCALER
# ══════════════════════════════════════════════════════════════

def load_all(
    scaler_path    = 'scaler_prediksi.pkl',
    model_revenue  = 'model_prediksi.keras',
    model_product  = 'model_product.keras',
    model_stock    = 'model_stock.keras',
):
    """Load semua model dan scaler bundle."""
    print('[FinSense] Loading models & scalers...')

    with open(scaler_path, 'rb') as f:
        bundle = pickle.load(f)

    models = {}
    models['revenue'] = keras.models.load_model(
        model_revenue, custom_objects=CUSTOM_OBJECTS)
    models['product'] = keras.models.load_model(
        model_product, custom_objects=CUSTOM_OBJECTS)
    models['stock']   = keras.models.load_model(
        model_stock,   custom_objects=CUSTOM_OBJECTS)

    print('[FinSense] Semua model siap.\n')
    return models, bundle


# ══════════════════════════════════════════════════════════════
# HELPER: Buat fitur musiman untuk satu tanggal
# ══════════════════════════════════════════════════════════════

def _is_ramadan(date: datetime) -> int:
    """Cek apakah tanggal termasuk periode Ramadan."""
    ramadan_periods = [
        ('2023-03-23', '2023-04-21'),
        ('2024-03-11', '2024-04-09'),
        ('2025-03-01', '2025-03-30'),  # estimasi 2025
        ('2026-02-18', '2026-03-19'),  # estimasi 2026
    ]
    for start, end in ramadan_periods:
        if pd.Timestamp(start) <= date <= pd.Timestamp(end):
            return 1
    return 0


def _is_lebaran(date: datetime) -> int:
    """Cek apakah tanggal termasuk periode Lebaran."""
    lebaran_dates = [
        '2023-04-22','2023-04-23','2023-04-24','2023-04-25','2023-04-26',
        '2024-04-10','2024-04-11','2024-04-12','2024-04-13','2024-04-14',
        '2025-03-31','2025-04-01','2025-04-02','2025-04-03','2025-04-04',
    ]
    return 1 if date.strftime('%Y-%m-%d') in lebaran_dates else 0


def _is_nataru(date: datetime) -> int:
    """Cek apakah tanggal termasuk periode Nataru."""
    return 1 if (date.month == 12 and date.day >= 15) or \
                (date.month == 1  and date.day <= 5) else 0


ID_HOLIDAYS = holidays.Indonesia()


# ══════════════════════════════════════════════════════════════
# FUNGSI PREDIKSI 1: REVENUE
# ══════════════════════════════════════════════════════════════

def predict_revenue(models, bundle, last_7_days: list[dict]) -> dict:
    """
    Prediksi total pemasukan toko hari berikutnya.

    Parameters
    ----------
    last_7_days : list of dict, panjang = 7 (urutan lama → baru)
        Key yang dibutuhkan per dict:
        {
            "date"        : "2024-12-30",   # string YYYY-MM-DD
            "Revenue"     : 1500000,
            "TxCount"     : 120,
            "AvgUnitPrice": 18000,
            "TotalUnits"  : 83
        }
        Fitur musiman (IsHoliday, IsRamadan, dll) dihitung otomatis dari tanggal.

    Returns
    -------
    {
        "predicted_revenue": 1850000.0,
        "currency": "IDR",
        "prediction_date": "2024-12-31"
    }
    """
    WINDOW   = bundle['window']
    sc_X     = bundle['revenue_scaler_X']
    sc_y     = bundle['revenue_scaler_y']
    features = bundle['revenue_features']
    model    = models['revenue']

    # Hitung RevMA dari history
    revenues = [d['Revenue'] for d in last_7_days]
    rev_ma7  = np.mean(revenues[-7:])  if len(revenues) >= 7  else np.mean(revenues)
    rev_ma14 = np.mean(revenues[-14:]) if len(revenues) >= 14 else np.mean(revenues)
    rev_ma30 = np.mean(revenues[-30:]) if len(revenues) >= 30 else np.mean(revenues)

    rows = []
    for idx, d in enumerate(last_7_days[-WINDOW:]):
        date = pd.Timestamp(d['date'])
        row = {
            'Revenue'     : d['Revenue'],
            'TxCount'     : d['TxCount'],
            'AvgUnitPrice': d['AvgUnitPrice'],
            'TotalUnits'  : d['TotalUnits'],
            'DayOfWeek'   : date.dayofweek,
            'DayOfMonth'  : date.day,
            'Month'       : date.month,
            'IsWeekend'   : int(date.dayofweek >= 5),
            'RevMA7'      : rev_ma7,
            'RevMA14'     : rev_ma14,
            'RevMA30'     : rev_ma30,
            'RevLag1'     : revenues[-(WINDOW - idx)]     if idx > 0 else revenues[0],
            'RevLag7'     : revenues[-(WINDOW - idx + 7)] if (WINDOW - idx + 7) <= len(revenues) else revenues[0],
            'IsHoliday'   : int(date in ID_HOLIDAYS),
            'IsRamadan'   : _is_ramadan(date),
            'IsLebaran'   : _is_lebaran(date),
            'IsNataru'    : _is_nataru(date),
        }
        rows.append([row[f] for f in features])

    seq        = sc_X.transform(np.array(rows, dtype=np.float32))
    seq        = seq.reshape(1, WINDOW, len(features)).astype(np.float32)
    pred_sc    = model.predict(seq, verbose=0)
    pred_value = sc_y.inverse_transform(pred_sc.reshape(-1, 1))

    # Hitung tanggal prediksi (hari setelah data terakhir)
    last_date      = pd.Timestamp(last_7_days[-1]['date'])
    pred_date      = (last_date + timedelta(days=1)).strftime('%Y-%m-%d')

    return {
        'predicted_revenue': round(float(pred_value[0][0]), 2),
        'currency'         : 'IDR',
        'prediction_date'  : pred_date,
    }


# ══════════════════════════════════════════════════════════════
# FUNGSI PREDIKSI 2: TOP PRODUCT
# ══════════════════════════════════════════════════════════════

def predict_top_products(models, bundle, today: dict) -> dict:
    """
    Prediksi apakah top-5 produk terlaris akan masuk top seller hari ini.

    Parameters
    ----------
    today : dict
        {
            "TotalRevenue": 1500000,
            "TotalUnits"  : 83,
            "TxCount"     : 120,
            "DayOfWeek"   : 0,       # 0=Senin ... 6=Minggu
            "IsWeekend"   : 0,
            "DayOfMonth"  : 15,
            "Month"       : 5,
            "RevLag1"     : 1400000, # revenue kemarin
            "RevLag2"     : 1350000, # revenue 2 hari lalu
            "UnitsLag1"   : 79,      # total unit kemarin
            "RevMA3"      : 1416666  # rata-rata revenue 3 hari
        }

    Returns
    -------
    {
        "top_products": [
            {"product": "Make Over Lipmatte",  "is_top_seller": true,  "probability": 0.92},
            {"product": "OMG Lipcream",        "is_top_seller": true,  "probability": 0.88},
            ...
        ]
    }
    """
    features    = bundle['product_features']
    sc_X        = bundle['product_scaler_X']
    top_products= bundle['top_products']
    model       = models['product']

    x_raw    = np.array([[today.get(f, 0) for f in features]], dtype=np.float32)
    x_scaled = sc_X.transform(x_raw)

    probs = model.predict(x_scaled, verbose=0)[0]  # (5,)

    return {
        'top_products': [
            {
                'product'      : prod,
                'is_top_seller': bool(probs[i] >= 0.5),
                'probability'  : round(float(probs[i]), 4),
            }
            for i, prod in enumerate(top_products)
        ]
    }


# ══════════════════════════════════════════════════════════════
# FUNGSI PREDIKSI 3: STOCK
# ══════════════════════════════════════════════════════════════

def predict_stock(models, bundle, product_name: str,
                  last_7_days_stock: list[dict]) -> dict:
    """
    Prediksi apakah produk tertentu perlu direstok besok.

    Parameters
    ----------
    product_name : str — nama produk (harus ada di top_n training)

    last_7_days_stock : list of dict, panjang = 7 (lama → baru)
        {
            "Units_Sold" : 45,
            "Stock_Out"  : 45,
            "Stock_In"   : 0,
            "DayOfWeek"  : 0,
            "DayOfMonth" : 15,
            "Month"      : 5,
            "Stock_End"  : 320   # stok akhir hari ini
        }
        ProductID, StockMA3, StockMA7, StockRatio, StockLag1,
        StockTrend3, StockDaysLeft, BelowThresh dihitung otomatis.

    Returns
    -------
    {
        "product_name"    : "Make Over Lipmatte",
        "need_restock"    : true,
        "probability"     : 0.73,
        "current_stock"   : 85,
        "restock_threshold": 100
    }
    """
    from sklearn.preprocessing import LabelEncoder

    sc         = bundle['stock_scaler']
    feat_cols  = bundle['stock_features']
    le         = bundle['stock_le']
    threshold  = bundle.get('stock_best_thresh', 0.45)
    restock_th = bundle.get('stock_threshold', 100)
    model      = models['stock']
    WINDOW     = bundle['window']

    if product_name not in bundle['all_products']:
        return {'error': f'Produk tidak dikenal: {product_name}'}

    pid = int(le.transform([product_name])[0])

    # Hitung fitur turunan dari histori 7 hari
    stock_ends   = [d['Stock_End']  for d in last_7_days_stock]
    stock_outs   = [d['Stock_Out']  for d in last_7_days_stock]
    avg_out      = max(np.mean(stock_outs), 1)

    rows = []
    for i, d in enumerate(last_7_days_stock[-WINDOW:]):
        stock_end  = d['Stock_End']
        stock_ma3  = np.mean(stock_ends[max(0, i-2):i+1])
        stock_ma7  = np.mean(stock_ends[max(0, i-6):i+1])
        stock_lag1 = stock_ends[i-1] if i > 0 else stock_end
        stock_tr3  = stock_ends[i] - stock_ends[max(0, i-3)]
        days_left  = min(stock_end / avg_out, 30)
        below      = int(stock_end < restock_th)

        row = {
            'Units_Sold'  : d['Units_Sold'],
            'Stock_Out'   : d['Stock_Out'],
            'Stock_In'    : d['Stock_In'],
            'DayOfWeek'   : d['DayOfWeek'],
            'DayOfMonth'  : d['DayOfMonth'],
            'Month'       : d['Month'],
            'ProductID'   : pid,
            'StockMA3'    : stock_ma3,
            'StockMA7'    : stock_ma7,
            'IsRestokDay' : int(d['Stock_In'] > 0),
            'StockRatio'  : d['Stock_Out'] / (stock_end + d['Stock_Out'] + 1),
            'StockLag1'   : stock_lag1,
            'StockTrend3' : stock_tr3,
            'StockDaysLeft': days_left,
            'BelowThresh' : below,
        }
        rows.append([row[f] for f in feat_cols])

    seq_scaled = sc.transform(np.array(rows, dtype=np.float32))
    seq_input  = seq_scaled.reshape(1, WINDOW, len(feat_cols)).astype(np.float32)

    prob       = float(model.predict(seq_input, verbose=0)[0][0])
    need       = prob >= threshold

    return {
        'product_name'     : product_name,
        'need_restock'     : need,
        'probability'      : round(prob, 4),
        'current_stock'    : int(last_7_days_stock[-1]['Stock_End']),
        'restock_threshold': restock_th,
    }


# ══════════════════════════════════════════════════════════════
# DEMO — jalankan langsung
# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import json

    # Load model & scaler
    models, bundle = load_all(
        scaler_path   = 'scaler_prediksi.pkl',
        model_revenue = 'model_prediksi.keras',
        model_product = 'model_product.keras',
        model_stock   = 'model_stock.keras',
    )

    print('Top 5 produk yang dikenal model:')
    for p in bundle['top_products']:
        print(f'  - {p}')
    print()

    # ── Demo 1: Revenue ──────────────────────────────────────
    last7_rev = [
        {'date':'2024-12-24','Revenue':1200000,'TxCount':95, 'AvgUnitPrice':18000,'TotalUnits':67},
        {'date':'2024-12-25','Revenue':5800000,'TxCount':210,'AvgUnitPrice':21000,'TotalUnits':276},
        {'date':'2024-12-26','Revenue':3200000,'TxCount':145,'AvgUnitPrice':19500,'TotalUnits':164},
        {'date':'2024-12-27','Revenue':1400000,'TxCount':108,'AvgUnitPrice':17500,'TotalUnits':80},
        {'date':'2024-12-28','Revenue':1350000,'TxCount':102,'AvgUnitPrice':18200,'TotalUnits':74},
        {'date':'2024-12-29','Revenue':1500000,'TxCount':115,'AvgUnitPrice':18500,'TotalUnits':81},
        {'date':'2024-12-30','Revenue':5500000,'TxCount':198,'AvgUnitPrice':20000,'TotalUnits':275},
    ]
    result_rev = predict_revenue(models, bundle, last7_rev)
    print('─' * 50)
    print('DEMO 1 — Prediksi Pemasukan')
    print('─' * 50)
    print(json.dumps(result_rev, indent=2, ensure_ascii=False))

    # ── Demo 2: Top Product ───────────────────────────────────
    today_feat = {
        'TotalRevenue': 1500000,
        'TotalUnits'  : 81,
        'TxCount'     : 115,
        'DayOfWeek'   : 0,
        'IsWeekend'   : 0,
        'DayOfMonth'  : 30,
        'Month'       : 12,
        'RevLag1'     : 1350000,
        'RevLag2'     : 1400000,
        'UnitsLag1'   : 74,
        'RevMA3'      : 1416666,
    }
    result_prod = predict_top_products(models, bundle, today_feat)
    print('\n' + '─' * 50)
    print('DEMO 2 — Top 5 Produk Terlaris')
    print('─' * 50)
    for item in result_prod['top_products']:
        status = '✅ TOP' if item['is_top_seller'] else '❌'
        print(f"  {status} {item['product']:<35} prob={item['probability']:.2f}")

    # ── Demo 3: Stock ─────────────────────────────────────────
    sample_product = bundle['top_products'][0]
    last7_stk = [
        {'Units_Sold':45,'Stock_Out':45,'Stock_In':0,  'DayOfWeek':1,'DayOfMonth':24,'Month':12,'Stock_End':320},
        {'Units_Sold':80,'Stock_Out':80,'Stock_In':0,  'DayOfWeek':2,'DayOfMonth':25,'Month':12,'Stock_End':240},
        {'Units_Sold':60,'Stock_Out':60,'Stock_In':200,'DayOfWeek':3,'DayOfMonth':26,'Month':12,'Stock_End':380},
        {'Units_Sold':50,'Stock_Out':50,'Stock_In':0,  'DayOfWeek':4,'DayOfMonth':27,'Month':12,'Stock_End':330},
        {'Units_Sold':48,'Stock_Out':48,'Stock_In':0,  'DayOfWeek':5,'DayOfMonth':28,'Month':12,'Stock_End':282},
        {'Units_Sold':47,'Stock_Out':47,'Stock_In':0,  'DayOfWeek':6,'DayOfMonth':29,'Month':12,'Stock_End':235},
        {'Units_Sold':75,'Stock_Out':75,'Stock_In':0,  'DayOfWeek':0,'DayOfMonth':30,'Month':12,'Stock_End':160},
    ]
    result_stk = predict_stock(models, bundle, sample_product, last7_stk)
    print('\n' + '─' * 50)
    print('DEMO 3 — Prediksi Stok')
    print('─' * 50)
    print(json.dumps(result_stk, indent=2, ensure_ascii=False))
    print()

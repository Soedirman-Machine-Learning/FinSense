const axios = require('axios');
const prisma = require('../config/prisma');

const AI_PRED_URL =
  process.env.PREDICTION_SERVICE_URL || 'http://localhost:8000/predict';

// ========== HELPER: Cek apakah toko memiliki cukup data ==========
async function hasMinimumTransactionData(
  userId,
  minDays = 7,
  minTransactions = 5,
) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (minDays - 1));
  startDate.setHours(0, 0, 0, 0);

  const count = await prisma.transaction.count({
    where: {
      user_id: userId,
      type: 'income',
      transaction_date: { gte: startDate, lte: endDate },
    },
  });
  return count >= minTransactions;
}

// ========== HELPER: Ambil 7 hari terakhir revenue ==========
async function getLast7DaysRevenue(userId) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  const transactions = await prisma.transaction.findMany({
    where: {
      user_id: userId,
      type: 'income',
      transaction_date: { gte: startDate, lte: endDate },
    },
    select: { amount: true, transaction_date: true, items: true },
  });

  const daily = {};
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const key = currentDate.toISOString().split('T')[0];
    daily[key] = {
      Revenue: 0,
      TxCount: 0,
      TotalUnits: 0,
      AvgUnitPrice: 0,
    };
    currentDate.setDate(currentDate.getDate() + 1);
  }

  for (const tx of transactions) {
    const key = tx.transaction_date.toISOString().split('T')[0];
    if (daily[key]) {
      daily[key].Revenue += tx.amount;
      daily[key].TxCount += 1;
      let units = 0;
      if (Array.isArray(tx.items)) {
        units = tx.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      }
      daily[key].TotalUnits += units;
    }
  }

  for (const key in daily) {
    const day = daily[key];
    day.AvgUnitPrice = day.TxCount > 0 ? day.Revenue / day.TxCount : 0;
  }

  const last7 = Object.keys(daily)
    .sort()
    .map((date) => ({
      date,
      Revenue: daily[date].Revenue,
      TxCount: daily[date].TxCount,
      TotalUnits: daily[date].TotalUnits,
      AvgUnitPrice: daily[date].AvgUnitPrice,
    }));
  return last7;
}

// ========== HELPER: Fitur hari ini untuk top products ==========
async function getTodayFeatures(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const [todayTx, yesterdayTx, twoDaysTx, threeDaysTx] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        user_id: userId,
        type: 'income',
        transaction_date: {
          gte: today,
          lt: new Date(today.getTime() + 86400000),
        },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        user_id: userId,
        type: 'income',
        transaction_date: { gte: yesterday, lt: today },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        user_id: userId,
        type: 'income',
        transaction_date: { gte: twoDaysAgo, lt: yesterday },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        user_id: userId,
        type: 'income',
        transaction_date: { gte: threeDaysAgo, lt: twoDaysAgo },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const todayTransactions = await prisma.transaction.findMany({
    where: {
      user_id: userId,
      type: 'income',
      transaction_date: {
        gte: today,
        lt: new Date(today.getTime() + 86400000),
      },
    },
    select: { items: true },
  });
  let todayUnits = 0;
  for (const tx of todayTransactions)
    if (Array.isArray(tx.items))
      todayUnits += tx.items.reduce((s, i) => s + (i.quantity || 0), 0);
  const yesterdayTransactions = await prisma.transaction.findMany({
    where: {
      user_id: userId,
      type: 'income',
      transaction_date: { gte: yesterday, lt: today },
    },
    select: { items: true },
  });
  let yesterdayUnits = 0;
  for (const tx of yesterdayTransactions)
    if (Array.isArray(tx.items))
      yesterdayUnits += tx.items.reduce((s, i) => s + (i.quantity || 0), 0);

  const todayRev = todayTx._sum.amount || 0;
  const yesterdayRev = yesterdayTx._sum.amount || 0;
  const twoDaysRev = twoDaysTx._sum.amount || 0;
  const revMA3 = (todayRev + yesterdayRev + twoDaysRev) / 3;

  return {
    TotalRevenue: todayRev,
    TotalUnits: todayUnits,
    TxCount: todayTx._count || 0,
    DayOfWeek: today.getDay(),
    IsWeekend: today.getDay() === 0 || today.getDay() === 6 ? 1 : 0,
    DayOfMonth: today.getDate(),
    Month: today.getMonth() + 1,
    RevLag1: yesterdayRev,
    RevLag2: twoDaysRev,
    UnitsLag1: yesterdayUnits,
    RevMA3: revMA3,
  };
}

// ========== HELPER: Stock history 7 hari ==========
async function getLast7DaysStock(userId, productId) {
  const product = await prisma.product.findFirst({
    where: { id: productId, user_id: userId },
  });
  if (!product) throw new Error('Product not found');
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);
  const daily = {};
  let current = new Date(startDate);
  while (current <= endDate) {
    const key = current.toISOString().split('T')[0];
    daily[key] = {
      Units_Sold: 0,
      Stock_Out: 0,
      Stock_In: 0,
      DayOfWeek: current.getDay(),
      DayOfMonth: current.getDate(),
      Month: current.getMonth() + 1,
    };
    current.setDate(current.getDate() + 1);
  }
  const transactions = await prisma.transaction.findMany({
    where: {
      user_id: userId,
      type: 'income',
      transaction_date: { gte: startDate, lte: endDate },
    },
    select: { transaction_date: true, items: true },
  });
  for (const tx of transactions) {
    const dateKey = tx.transaction_date.toISOString().split('T')[0];
    if (daily[dateKey] && Array.isArray(tx.items)) {
      const item = tx.items.find(
        (i) =>
          i.productId === productId ||
          i.product_id === productId ||
          i.id === productId,
      );
      if (item && item.quantity) {
        daily[dateKey].Units_Sold += item.quantity;
        daily[dateKey].Stock_Out += item.quantity;
      }
    }
  }
  let stockLogs = [];
  try {
    stockLogs = await prisma.stockLog.findMany({
      where: {
        product_id: productId,
        created_at: { gte: startDate, lte: endDate },
      },
      select: { quantity: true, created_at: true, type: true },
    });
  } catch (e) {}
  for (const log of stockLogs) {
    const dateKey = log.created_at.toISOString().split('T')[0];
    if (daily[dateKey]) {
      if (log.type === 'in' || log.quantity > 0)
        daily[dateKey].Stock_In += log.quantity;
      else if (log.type === 'out' && log.quantity < 0)
        daily[dateKey].Stock_Out += Math.abs(log.quantity);
    }
  }
  const sortedKeys = Object.keys(daily).sort();
  let totalNetChange = 0;
  for (const key of sortedKeys)
    totalNetChange += daily[key].Stock_In - daily[key].Stock_Out;
  let runningStock = product.stock - totalNetChange;
  const result = [];
  for (const key of sortedKeys) {
    runningStock += daily[key].Stock_In - daily[key].Stock_Out;
    result.push({
      Units_Sold: daily[key].Units_Sold,
      Stock_Out: daily[key].Stock_Out,
      Stock_In: daily[key].Stock_In,
      DayOfWeek: daily[key].DayOfWeek,
      DayOfMonth: daily[key].DayOfMonth,
      Month: daily[key].Month,
      Stock_End: Math.max(0, runningStock),
    });
  }
  return result;
}

function generateMinimalStockData(currentStock) {
  const today = new Date();
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    last7.push({
      Units_Sold: 0,
      Stock_Out: 0,
      Stock_In: 0,
      DayOfWeek: date.getDay(),
      DayOfMonth: date.getDate(),
      Month: date.getMonth() + 1,
      Stock_End: currentStock,
    });
  }
  return last7;
}

// ========== CONTROLLERS ==========

// 1. PREDIKSI REVENUE (dengan validasi minimal data)
// Helper untuk menghitung moving average (sebagai baseline)
async function getMovingAveragePrediction(userId) {
  const last7 = await getLast7DaysRevenue(userId);
  const revenues = last7.map(d => d.Revenue);
  if (revenues.length === 0) return 0;
  // Weighted moving average (bobot lebih pada hari terakhir)
  const weights = [0.05, 0.07, 0.1, 0.13, 0.18, 0.22, 0.25];
  let weighted = 0;
  for (let i = 0; i < revenues.length; i++) {
    weighted += revenues[i] * weights[i];
  }
  return Math.round(weighted);
}

// PREDIKSI REVENUE dengan validasi kewajaran
exports.predictRevenue = async (req, res) => {
  try {
    const userId = req.userId;
    const hasData = await hasMinimumTransactionData(userId, 7, 5);
    if (!hasData) {
      return res.status(200).json({
        available: false,
        message: 'Prediksi AI tersedia setelah 7 hari penggunaan dengan minimal 5 transaksi',
        predicted_revenue: null,
        currency: 'IDR',
        prediction_date: new Date().toISOString().split('T')[0],
      });
    }

    // 1. Dapatkan prediksi dari AI
    const last7 = await getLast7DaysRevenue(userId);
    const response = await axios.post(`${AI_PRED_URL}/predict-revenue`, { last_7_days: last7 });
    let aiPrediction = response.data.predicted_revenue;

    // 2. Hitung baseline moving average dari data aktual
    const baseline = await getMovingAveragePrediction(userId);
    const avgRevenue = last7.reduce((sum, d) => sum + d.Revenue, 0) / last7.length;

    // 3. Validasi: jika prediksi AI lebih dari 4x rata-rata atau kurang dari 0.25x rata-rata
    let finalPrediction = aiPrediction;
    let note = null;
    if (aiPrediction > avgRevenue * 4 || aiPrediction < avgRevenue * 0.25) {
      finalPrediction = null;
      note = 'Prediksi AI tidak stabil karena data belum cukup. Gunakan estimasi manual.';
    }

    res.json({
      available: true,
      predicted_revenue: finalPrediction, // bisa null jika meleset
      note: note,
      currency: 'IDR',
      prediction_date: response.data.prediction_date,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// 2. PREDIKSI TOP PRODUCTS (dengan validasi + fallback)
exports.predictTopProducts = async (req, res) => {
  try {
    const userId = req.userId;
    const hasData = await hasMinimumTransactionData(userId, 7, 5);
    if (!hasData) {
      // Fallback: ambil real top products dari database
      const realTop = await exports.getRealTopProductsData(userId);
      return res.status(200).json({
        available: false,
        message:
          'Prediksi AI tersedia setelah 7 hari penggunaan. Menampilkan produk terlaris dari database.',
        top_products: realTop,
      });
    }
    const features = await getTodayFeatures(userId);
    const response = await axios.post(`${AI_PRED_URL}/predict-top-products`, {
      today_features: features,
    });
    res.json({ available: true, ...response.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. PREDIKSI STOCK
exports.predictStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.userId;
    const product = await prisma.product.findFirst({
      where: { id: productId, user_id: userId },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock <= product.min_stock) {
      return res.json({
        product_name: product.name,
        need_restock: true,
        probability: 1.0,
        current_stock: product.stock,
        restock_threshold: product.min_stock,
        note: 'Stok menipis, segera restok',
      });
    }
    let last7 = [];
    try {
      last7 = await getLast7DaysStock(userId, productId);
    } catch (e) {
      last7 = generateMinimalStockData(product.stock);
    }
    if (!last7 || last7.length === 0)
      last7 = generateMinimalStockData(product.stock);
    const hasRealSales = last7.some((d) => d.Units_Sold > 0);
    const hasStockChanges = last7.some((d) => d.Stock_End !== product.stock);
    const isLowStock = product.stock <= (product.min_stock || 10);
    if (!hasRealSales && !hasStockChanges && !isLowStock) {
      return res.json({
        product_name: product.name,
        need_restock: false,
        probability: 0,
        current_stock: product.stock,
        restock_threshold: product.min_stock || 100,
        note: 'Data tidak cukup',
      });
    }
    let aiResponse;
    try {
      aiResponse = await axios.post(`${AI_PRED_URL}/predict-stock`, {
        product_name: product.name,
        last_7_days_stock: last7,
      });
    } catch (aiErr) {
      if (aiErr.response?.status === 404 || product.stock === 0) {
        return res.json({
          product_name: product.name,
          need_restock: product.stock === 0,
          probability: product.stock === 0 ? 1 : 0,
          current_stock: product.stock,
          restock_threshold: product.min_stock || 100,
          note:
            product.stock === 0
              ? 'Stok habis, segera restok'
              : 'Produk tidak dikenal AI',
        });
      }
      throw aiErr;
    }
    res.json(aiResponse.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. REAL TOP PRODUCTS (dari TransactionItem)
exports.getRealTopProducts = async (req, res) => {
  try {
    const userId = req.userId;
    const topItems = await exports.getRealTopProductsData(userId);
    res.json({ top_products: topItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper untuk mengambil data real top products (bisa dipanggil internal)
exports.getRealTopProductsData = async (userId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const topItems = await prisma.transactionItem.groupBy({
    by: ['product_id', 'item_name'],
    where: {
      transaction: {
        user_id: userId,
        type: 'income',
        transaction_date: { gte: thirtyDaysAgo },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });
  return topItems.map((item) => ({
    product: item.item_name,
    is_top_seller: true,
    probability: 1.0,
    total_terjual: item._sum.quantity,
  }));
};

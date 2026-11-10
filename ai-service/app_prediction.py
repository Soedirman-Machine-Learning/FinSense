# app_prediction.py
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import uvicorn
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import json

# Import semua fungsi dari get_prediction.py
from get_prediction import (
    load_all, predict_revenue, predict_top_products, predict_stock
)

# Inisialisasi FastAPI
app = FastAPI(title="FinSense Prediction API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load semua model sekali saat startup
print("[FinSense AI] Loading models...")
models, bundle = load_all(
    scaler_path='scaler_prediksi.pkl',
    model_revenue='model_prediksi.keras',
    model_product='model_product.keras',
    model_stock='model_stock.keras',
)
print("[FinSense AI] Models ready.")

# ========== Request/Response Models ==========
class RevenueRequest(BaseModel):
    last_7_days: List[Dict[str, Any]]   # lihat format di demo

class RevenueResponse(BaseModel):
    predicted_revenue: float
    currency: str
    prediction_date: str

class TopProductsRequest(BaseModel):
    today_features: Dict[str, Any]

class TopProductsResponse(BaseModel):
    top_products: List[Dict[str, Any]]

class StockRequest(BaseModel):
    product_name: str
    last_7_days_stock: List[Dict[str, Any]]

class StockResponse(BaseModel):
    product_name: str
    need_restock: bool
    probability: float
    current_stock: int
    restock_threshold: int

# ========== Endpoints ==========
@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict-revenue", response_model=RevenueResponse)
async def revenue_endpoint(req: RevenueRequest):
    try:
        result = predict_revenue(models, bundle, req.last_7_days)
        return result
    except Exception as e:
        raise HTTPException(500, f"Revenue prediction failed: {str(e)}")

@app.post("/predict-top-products", response_model=TopProductsResponse)
async def top_products_endpoint(req: TopProductsRequest):
    try:
        result = predict_top_products(models, bundle, req.today_features)
        return result
    except Exception as e:
        raise HTTPException(500, f"Top products prediction failed: {str(e)}")

@app.post("/predict-stock", response_model=StockResponse)
async def stock_endpoint(req: StockRequest):
    try:
        result = predict_stock(models, bundle, req.product_name, req.last_7_days_stock)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Stock prediction failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
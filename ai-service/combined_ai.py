import sys
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

print("=== Starting app.py ===", flush=True)

try:
    # Import sub-apps (model loading terjadi di sini)
    print("Importing serve_model...", flush=True)
    from serve_model import app as voice_app
    print("Importing app_prediction...", flush=True)
    from app_prediction import app as pred_app
    print("All imports done", flush=True)

    # Buat app utama
    app = FastAPI(title="FinSense AI Combined")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    app.mount("/voice", voice_app)
    app.mount("/predict", pred_app)

    @app.get("/")
    async def root():
        return {"status": "ok", "message": "FinSense AI running"}

    print("App created successfully. Server will start now.", flush=True)
except Exception as e:
    print(f"FATAL ERROR: {e}", flush=True)
    sys.exit(1)

# ⚠️ TAMBAHKAN KODE INI DI BAGIAN PALING BAWAH AGAR SERVER BENAR-BENAR MENYALA DI PORT 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("combined_ai:app", host="127.0.0.1", port=8000, reload=True)
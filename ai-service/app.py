"""
Titik masuk FinSense AI di Hugging Face Spaces (SDK Gradio, hardware ZeroGPU).
==============================================================================

Kenapa berkas ini ada, padahal combined_ai.py sudah menjalankan layanan yang
sama: Hugging Face tidak lagi menggratiskan Docker Space. Yang gratis untuk
akun biasa tinggal Gradio Space di ZeroGPU, dan ZeroGPU punya dua syarat —
aplikasinya harus di-launch oleh Gradio, dan harus ada minimal satu fungsi
berdekorator @spaces.GPU. Tanpa itu Space berhenti dengan galat
"No @spaces.GPU function detected during startup".

Jadi berkas ini menyalakan halaman Gradio seadanya, lalu memasang dua
sub-aplikasi FastAPI yang sudah ada di server yang sama, pada path yang sama
persis dengan combined_ai.py:

    /voice/     pengenalan produk dari suara   (serve_model.py)
    /predict/   prediksi pendapatan & stok     (app_prediction.py)

Backend tidak perlu tahu bedanya: cukup arahkan AI_SERVICE_URL dan
PREDICTION_SERVICE_URL ke alamat Space.

Model tetap berjalan di CPU. ZeroGPU dirancang untuk PyTorch dan tidak
menyediakan GPU bagi TensorFlow; untuk model sekecil ini CPU sudah cukup.

Untuk menjalankan di laptop tetap pakai combined_ai.py. Berkas ini juga bisa
dijalankan lokal (python app.py) kalau gradio terpasang; paket `spaces` hanya
ada di Hugging Face dan dilewati bila tidak ditemukan.
"""

import os

try:
    # Harus diimpor sebelum pustaka ML mana pun — begitu aturan ZeroGPU.
    import spaces
except ImportError:  # di luar Hugging Face
    spaces = None

import gradio as gr

try:
    # Sembunyikan GPU dari TensorFlow. Di ZeroGPU ada pustaka CUDA milik
    # PyTorch; tanpa baris ini TensorFlow mencoba memakainya dan gagal dengan
    # cara yang membingungkan. Harus dipanggil sebelum model pertama dibuat.
    import tensorflow as tf

    tf.config.set_visible_devices([], "GPU")
except Exception as exc:  # jangan sampai ini yang menggagalkan startup
    print(f"[app] GPU tidak disembunyikan dari TensorFlow: {exc}", flush=True)

# Mengimpor kedua modul ini memuat seluruh model — sengaja dilakukan saat
# startup supaya request pertama tidak menanggung waktu muat.
from serve_model import app as voice_app  # noqa: E402
from app_prediction import app as pred_app  # noqa: E402


def _zerogpu_placeholder():
    """Tidak melakukan apa-apa. Ada hanya untuk memenuhi pemeriksaan ZeroGPU."""
    return "ok"


if spaces is not None:
    _zerogpu_placeholder = spaces.GPU(_zerogpu_placeholder)


with gr.Blocks(title="FinSense AI") as demo:
    gr.Markdown(
        "# FinSense AI\n"
        "Layanan API untuk aplikasi FinSense — bukan halaman untuk dipakai langsung.\n\n"
        "- `GET /voice/health` — status model suara\n"
        "- `POST /voice/` — pengenalan produk dari rekaman\n"
        "- `GET /predict/health` — status model prediksi\n"
    )
    # Fungsi berdekorator harus terikat ke sebuah event supaya terdaftar.
    gr.Button("zerogpu", visible=False).click(_zerogpu_placeholder, outputs=gr.Textbox(visible=False))


if __name__ == "__main__":
    app, _, _ = demo.launch(
        server_name=os.environ.get("GRADIO_SERVER_NAME", "0.0.0.0"),
        server_port=int(os.environ.get("GRADIO_SERVER_PORT", "7860")),
        # SSR menaruh server Node di depan aplikasi; path di luar milik Gradio
        # (seperti /voice) belum tentu diteruskan. Dimatikan supaya pasti.
        ssr_mode=False,
        prevent_thread_lock=True,
    )
    # Dipasang SETELAH launch, karena objek FastAPI baru ada setelahnya.
    app.mount("/voice", voice_app)
    app.mount("/predict", pred_app)
    print("[app] /voice dan /predict terpasang", flush=True)
    demo.block_thread()

<div align="center">

# 💰 FinSense
### *Asisten Keuangan Cerdas untuk UMKM dengan Input Suara*

![Node.js](https://img.shields.io/badge/Node.js-20.19%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-MariaDB-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow-2-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

> **Capstone Project Coding Camp 2026** (Team ID: CC26-PSU282), dikembangkan lebih lanjut
> sebagai penelitian tugas akhir di Program Studi Teknik Elektro, Universitas Jenderal Soedirman.

</div>

---

## 📌 Tentang FinSense

FinSense adalah **asisten keuangan cerdas** untuk UMKM yang menggabungkan pencatatan transaksi manual,
**input suara** (ucapan → produk, jumlah, dan harga), serta **prediksi AI** untuk pemasukan,
rekomendasi restok, dan deteksi produk terlaris.

### 🎯 Masalah yang Diselesaikan

- ❌ UMKM kesulitan mencatat transaksi secara real-time
- ❌ Stok tidak terpantau → kehabisan atau overstock
- ❌ Sulit memprediksi pemasukan di masa depan
- ❌ Input transaksi lambat, terutama saat toko ramai dan kedua tangan sibuk melayani pembeli

### 💡 Solusi FinSense

- ✅ Pencatatan **cepat** (manual + suara)
- ✅ Dashboard **interaktif** & real-time
- ✅ Prediksi pemasukan dengan model time-series
- ✅ Rekomendasi **restok otomatis**
- ✅ **Input suara** untuk 121 produk bawaan, ditambah produk yang dimasukkan lewat aplikasi

---

## ✨ Fitur Unggulan

| Fitur | Deskripsi |
|-------|-----------|
| 🔐 **Autentikasi** | Login, register, reset password via email (JWT + refresh token) |
| 🛒 **POS + Suara** | Input transaksi dengan suara atau manual |
| 📊 **Dashboard** | Grafik pemasukan/pengeluaran, saldo, top 5 produk |
| 🔮 **Forecasting** | Prediksi pemasukan harian (LSTM + attention) |
| 📦 **Manajemen Stok** | CRUD produk, riwayat stok, notifikasi stok menipis |
| 💳 **Hutang/Piutang** | Pencatatan dan pemantauan hutang pelanggan |
| 🧠 **Rekomendasi AI** | Restok stok & produk terlaris dari model ML |

> 🗣️ **Pengenalan suara** mencakup **121 produk bawaan** ([lihat daftar](./PRODUCTS_LIST.md)).
> Produk yang ditambahkan lewat aplikasi ikut menjadi kandidat tanpa pelatihan ulang, selama
> namanya diucapkan sama seperti yang diketik (lihat [`ai-service/produk_tambahan.py`](./ai-service/produk_tambahan.py)).

---

## 🎓 Penelitian Tugas Akhir

Komponen pengenalan suara FinSense adalah objek penelitian tugas akhir berjudul
**"Rancang Bangun dan Analisis Model CNN-BiGRU-CTC untuk Transkripsi Perintah Suara Berbahasa
Indonesia pada Aplikasi Pencatatan Keuangan UMKM"** (Ibrahim Irfanul Haq, Program Studi Teknik
Elektro, Universitas Jenderal Soedirman, 2026).

- **Arsitektur:** CNN sebagai pengekstrak fitur, Bidirectional GRU sebagai pemodel konteks temporal,
  dan Connectionist Temporal Classification (CTC) untuk memetakan suara menjadi urutan karakter
  tanpa penyelarasan manual.
- **Pelatihan:** dari awal dengan TensorFlow, tanpa model pra-terlatih, pada 5.100 berkas
  (1.200 rekaman dari 20 penutur, 1.300 ucapan sintetis TTS, dan 2.600 salinan augmentasi)
  dengan fitur spektrogram log-Mel 80 kanal.
- **Penyempurnaan:** model v11 di-*fine-tune* pada korpus turunan 12.500 klip menjadi **v12**,
  lalu dilengkapi rescoring leksikon CTC dan pemahaman bahasa lisan berbasis aturan.
- **Penyajian:** layanan REST API FastAPI yang terhubung dengan aplikasi FinSense.

```
audio → log-Mel 80 kanal → CNN → BiGRU → probabilitas karakter per frame (CTC)
      → rescoring leksikon CTC atas 121 nama produk (+ produk dari database)
      → aturan intent & jumlah → transaksi {produk, jumlah, harga}
```

### 📈 Hasil Utama

| Pengujian | Hasil |
|---|---|
| Penutur yang dikenal (*speaker-dependent*) | CER 5.02%, WER 11.19% |
| Penutur baru (*speaker-independent*, 5 lipatan) | CER 11.52% ± 3.14%, WER 26.18% |
| Model v12, 1.250 klip validasi | CER 1.79%, akurasi produk 94.3% |
| Model v12, 144 ucapan uji langsung dari penutur di luar korpus | akurasi produk 91.67% |
| Jarak mikrofon 10–40 cm | tidak berpengaruh signifikan |
| Derau kendaraan | akurasi produk turun menjadi 77.08% |
| Pemahaman bahasa lisan | akurasi gabungan 91.20%, F1-Score produk 98.25% |
| Waktu layanan | inferensi ±351 ms per permintaan, ujung ke ujung ±2.0 detik |

---

## 🏗️ Arsitektur Sistem

```
┌──────────────────┐      ┌─────────────────────────┐      ┌──────────────────────────┐
│ Frontend         │ ───▶ │ Backend                 │ ───▶ │ AI Service (FastAPI)     │
│ React 19 + Vite  │      │ Express 5 + Prisma 7    │      │ /voice   pengenalan suara│
│ :5173            │      │ MySQL / MariaDB  :5000  │      │ /predict prediksi & stok │
└──────────────────┘      └─────────────────────────┘      │ :8000                    │
                                                           └──────────────────────────┘
```

---

## 🚀 Menjalankan Secara Lokal

### Prasyarat

- Node.js **20.19+** dan npm (dibutuhkan Vite 8 dan Prisma 7)
- Python **3.10 – 3.12**
- **MySQL 8** atau **MariaDB**
- ffmpeg

### 1. Clone repository

```bash
git clone https://github.com/Soedirman-Machine-Learning/FinSense.git
cd FinSense
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Isi .env: DATABASE_URL dan DB_* (harus menunjuk ke database yang sama), JWT_SECRET, dst.
# Membuat JWT_SECRET acak:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm install
npx prisma migrate deploy
npx prisma generate
npx prisma db seed     # kategori transaksi bawaan
npm run dev            # http://localhost:5000
```

Untuk MySQL lokal, pembuatan database dan migrasi juga bisa dijalankan sekaligus lewat
`bash scripts/setup-db.sh` (jalankan setelah `backend/.env` dibuat).

Setelah mendaftarkan akun pertama di aplikasi, masukkan 121 produk yang dikenali model suara
ke database:

```bash
node prisma/seedProducts.js            # atau: node prisma/seedProducts.js --user <uuid>
```

> 💡 Di macOS, port 5000 dipakai AirPlay Receiver. Setel `PORT=5001` di `backend/.env`
> dan sesuaikan `VITE_API_URL` di frontend.

### 3. AI Service

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python combined_ai.py         # http://127.0.0.1:8000
```

Cek status model: `curl http://127.0.0.1:8000/voice/health`.
Di `backend/.env`, isi `AI_SERVICE_URL=http://localhost:8000/voice/` (garis miring di akhir
wajib) dan `PREDICTION_SERVICE_URL=http://localhost:8000/predict`.

### 4. Frontend

```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                   # http://localhost:5173
```

Penjelasan setiap variabel lingkungan ada di `backend/.env.example` dan `frontend/.env.example`.
Berkas `.env` berisi rahasia dan sudah diabaikan oleh `.gitignore`, jadi jangan pernah di-commit.

---

## ☁️ Deploy

- **AI Service:** `ai-service/app.py` adalah titik masuk untuk Hugging Face Spaces (SDK Gradio),
  sedangkan `ai-service/Dockerfile` menjalankan `combined_ai.py` di port 7860.
- **Backend & Frontend:** masing-masing punya `vercel.json`. Isi variabel lingkungan lewat
  dashboard Vercel; `backend/.vercelignore` memastikan berkas `.env` tidak ikut terunggah.

---

## 📂 Struktur Proyek

```
FinSense/
├── ai-service/            # FastAPI: pengenalan suara (/voice) + prediksi (/predict)
│   ├── model_v12/         # model CNN-BiGRU-CTC yang dilayankan
│   ├── model_v11_ctc/     # model v11 + checkpoint evaluasi Skema A dan B
│   ├── model_v10/         # model v10 + tabel harga satuan 121 produk
│   ├── pengukuran/        # skrip pengukuran unjuk kerja layanan
│   ├── serve_model.py     # API pengenalan produk dari suara
│   ├── ctc_lexicon.py     # rescoring leksikon CTC
│   ├── produk_tambahan.py # produk dari database sebagai kandidat tambahan
│   ├── combined_ai.py     # titik masuk lokal (port 8000)
│   └── app.py             # titik masuk Hugging Face Spaces
├── backend/               # Express 5 + Prisma 7 (MySQL/MariaDB)
├── frontend/              # React 19 + Vite + Tailwind CSS 4
├── data-science/          # notebook, korpus Tahap 1, dashboard, kamus data
├── scripts/setup-db.sh    # menyiapkan database MySQL lokal
├── PRODUCTS_LIST.md       # 121 produk yang dikenali model suara
└── LICENSE
```

---

## 🤖 Model & Data

Seluruh model yang dibutuhkan layanan AI sudah disertakan di repository ini:

| Berkas | Fungsi |
|---|---|
| `ai-service/model_v12/finsense_ctc_v12.keras` | model suara yang dilayankan (`serve_model.py`) |
| `ai-service/model_v11_ctc/` | model v11 (sebelum *fine-tuning*) dan checkpoint evaluasi Skema A/B |
| `ai-service/model_v10/` | model v10 dan `unit_price_lookup.json` (harga satuan 121 produk) |
| `ai-service/model_prediksi.keras`, `model_product.keras`, `model_stock.keras`, `scaler_prediksi.pkl` | prediksi pemasukan, produk terlaris, dan restok |

Data yang tidak disertakan karena ukurannya besar:

| Data | Tautan | Penempatan |
|------|--------|------------|
| Dataset audio mentah | [Google Drive](https://drive.google.com/file/d/1WOqGILXNeduF-t2Ejjq8Dp4evxrx39PH/view?usp=sharing) | lihat [`data-science/data/raw/audio/`](./data-science/data/raw/audio/README.md) |
| Data hasil preprocessing | [Google Drive](https://drive.google.com/drive/folders/1mIRjNcGmQtct0z2QnpFC3AKbsFXZDMf0?usp=sharing) | `data-science/` |

Data transaksi mentah (200.000 baris) ada di `data-science/data/raw/transactions/`.

### 🎯 Decoding Produk (Tahap 0)

Produk tidak lagi ditentukan dengan mencocokkan string transkrip secara fuzzy.
Karena jawabannya selalu salah satu dari 121 produk, setiap nama produk diskor
langsung terhadap keluaran model dengan CTC forward algorithm, lalu yang
likelihood-nya tertinggi dipilih ([`ai-service/ctc_lexicon.py`](./ai-service/ctc_lexicon.py)).
Bobot model **tidak berubah** — tidak ada retraining.

Diukur pada 120 klip uji (40 produk × 3 kondisi ucapan, suara TTS di luar data latih):

| | kalimat penuh | produk saja | produk + jeda |
|---|---|---|---|
| fuzzy matching (lama) | 92.5% | 87.5% | 90.0% |
| rescoring CTC (baru) | **97.5%** | **95.0%** | **95.0%** |

Artinya perintah tidak lagi harus diucapkan sebagai satu kalimat penuh.
Latensi satu request juga turun dari ~1.6 detik ke ~90 ms, karena model kini
dipanggil lewat `tf.function` alih-alih eager.

Menjalankan ulang evaluasinya (butuh macOS untuk membangkitkan klip TTS):

```bash
cd ai-service
./venv/bin/python eval_tahap0.py --generate   # sekali, membuat eval_data/
./venv/bin/python eval_tahap0.py
```

### 📼 Korpus Ucapan Sepotong (Tahap 1)

Sebagian besar dari 5100 rekaman menyebut nama produk di **tengah** kalimat,
jadi model kurang terlatih pada ucapan yang berhenti tepat di nama produk.
[`data-science/tahap1/`](./data-science/tahap1/) memanen ulang rekaman itu:
forced alignment CTC menemukan batas tiap kata, lalu satu rekaman dipotong jadi
klip `produk saja` / `intent+produk` / `produk+qty` / `kalimat penuh` — semuanya
audio manusia asli dengan label yang pasti benar, tanpa merekam ulang apa pun.

Tiap klip lewat augmentasi yang meniru kondisi produksi: jeda sebelum bicara,
derau warung, ruangan bergema, level mikrofon, dan kompresi WebM/Opus dari
browser. Dari 5100 berkas (2500 rekaman unik — sisanya salinan pitch/noise/speed
bawaan dataset) keluar 12.500 klip, 14.2 jam audio.

Diverifikasi pada sampel acak 4000 klip: **98.2%** label terbukti cocok dengan
audionya pada klip bersih, dan sama akuratnya untuk gaya penyebutan template
(98.5%) maupun gaya bebas (98.0%).

```bash
cd data-science/tahap1
../../ai-service/venv/bin/python build_corpus.py \
    --audio-dir <dir wav sumber> --transcripts <csv> --out <dir keluaran>
../../ai-service/venv/bin/python verify_corpus.py --corpus <dir keluaran>
```

Detail lengkap: [data-science/tahap1/README.md](./data-science/tahap1/README.md).

### 🎓 Fine-tuning Model (Tahap 2)

[`data-science/notebooks/06_training_ctc.ipynb`](./data-science/notebooks/06_training_ctc.ipynb)
melatih ulang model di atas korpus Tahap 1, dirancang untuk dijalankan di
**Kaggle** dengan GPU. Pendekatannya fine-tuning dari v11, bukan melatih dari
nol — arsitekturnya tidak diubah sehingga model hasilnya bisa langsung
menggantikan v11 di `serve_model.py` dengan mengubah satu baris path. Model hasil
tahap ini, **v12**, adalah model yang kini dilayankan (`ai-service/model_v12/`).

Yang dipantau selama pelatihan bukan hanya loss CTC, melainkan **akurasi produk
memakai rescoring leksikon yang sama persis dengan produksi** — jadi angka yang
terlihat saat melatih adalah angka yang akan diterima pengguna.

Butuh dua dataset ter-attach di Kaggle: korpus Tahap 1, dan model v11 beserta
`char_vocab.json`.

> ⚠️ Setelah melatih, **wajib** jalankan `./venv/bin/python eval_tahap0.py` untuk
> mengkalibrasi ulang `MODEL_CONFIDENT_SCORE` dan `MAX_NLL_PER_CHAR`. Kedua
> ambang itu melekat pada skala keyakinan model, bukan besaran universal.

---

### 🎙️ Mode ASR: dengan atau tanpa layanan pihak ketiga

Sistem dapat berjalan **sepenuhnya dengan model sendiri**, tanpa Web Speech API
bawaan browser (ASR cloud milik Google). Itulah bawaannya sekarang.

| | `model_only` (bawaan) | `hybrid` |
|---|---|---|
| produk | rescoring leksikon CTC | rescoring leksikon CTC |
| jumlah | transkrip model sendiri | transkrip browser, model sebagai cadangan |
| jalur cadangan saat audio tak dikenali | tidak ada — ucapan ditolak | pencocokan kata kunci pada transkrip browser |
| butuh internet & Chrome | tidak | ya |

Produk tidak pernah ditentukan transkrip browser pada kedua mode; yang berbeda
hanya sumber jumlah dan jalur cadangan.

Menyalakan mode hybrid butuh **dua** saklar yang disetel bersama:

```bash
# layanan AI
FINSENSE_ASR_MODE=hybrid uvicorn serve_model:app --host 0.0.0.0 --port 8000

# frontend (.env)
VITE_PAKAI_WEB_SPEECH=true
```

Mode yang sedang aktif tercetak saat layanan dimuat, muncul di `GET /health`,
dan ikut dikembalikan pada tiap respons sebagai field `asr_mode`.

**Mengukur selisih kedua mode** atas audio yang sama, lewat fungsi keputusan
yang sama dengan yang dilayankan (`serve_model.putuskan_transaksi`):

```bash
cd ai-service
./venv/bin/python eval_mode_asr.py \
    --transcripts <csv filename,transcript> --audio-dir <dir wav> --limit 300
```

Skrip itu memberi mode hybrid **teks acuan** sebagai transkrip browsernya —
seolah ASR pihak ketiga bekerja sempurna. Jadi angkanya adalah *batas atas* bagi
hybrid, dan selisih yang terukur adalah kerugian TERBURUK yang mungkin terjadi
bila Web Speech dicabut.

---

## 👥 Tim Pengembang

| Nama | Role | Kontak |
|------|------|--------|
| Ibrahim Irfanul Haq | AI Engineer | [LinkedIn](https://www.linkedin.com/in/ibrahimirfanulhaq/) |
| Rafi Azhar Suadmaja | AI Engineer | [LinkedIn](https://www.linkedin.com/in/rafi-azhar-suadmaja-53493028b) |
| Alifah Mu’asyaroh | Data Scientist | [LinkedIn](https://www.linkedin.com/in/alifah-mu-asyaroh-8667513ab) |
| Alviyatur Rahmaniyah | Data Scientist | [LinkedIn](https://www.linkedin.com/in/alviyatur-rahmaniyah) |
| Hafizh Kusuma Abdillah | Full-Stack Developer | [LinkedIn](https://www.linkedin.com/in/hafizh-kusuma-abdillah-440102297/) |
| Rifki Ardiansah | Full-Stack Developer | [LinkedIn](https://www.linkedin.com/in/rifki-ardiansahh/) |

---

## 📄 Lisensi

Proyek ini dirilis di bawah [Lisensi MIT](./LICENSE).

---

<div align="center">
  Dibangun oleh Tim CC26-PSU282 · Dikembangkan lanjut di Universitas Jenderal Soedirman
</div>

# Data Science

## Overview

Folder ini berisi seluruh proses *data science* pada project FinSense. Proses ini mencakup preprocessing data transaksi, exploratory data analysis (EDA), preprocessing audio, pembentukan transkrip, pelabelan NLP (*intent* dan *entity*), serta evaluasi sistem melalui A/B testing untuk membandingkan efisiensi *voice input* dan *manual input*. Selain itu, tersedia laporan komprehensif yang mendokumentasikan seluruh proses analisis.

---

## Notebooks

| Notebook                         | Deskripsi                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `01_cleaning_transactions.ipynb` | Data preprocessing, transformation, stock simulation, dan dataset merging                      |
| `02_analysis_transactions.ipynb` | Exploratory Data Analysis (EDA) dan visualisasi transaksi                                      |
| `03_cleaning_audio.ipynb`        | Audio preprocessing (*mono conversion*, *resampling*, *normalization*, dan *silence trimming*) |
| `04_nlp_audio.ipynb`             | Pembentukan transkrip transaksi dan pelabelan NLP (*intent* dan *entity*)                      |
| `05_ab_testing.ipynb`            | Analisis A/B testing untuk membandingkan voice input vs manual input berdasarkan waktu        |
| `06_training_ctc.ipynb`          | Fine-tuning model CNN-BiGRU-CTC (Tahap 2) di atas korpus hasil forced alignment                |
| `07_evaluasi_cer_wer.ipynb`      | Evaluasi keandalan model transkripsi: CER & WER pada skenario *speaker-dependent* dan *speaker-independent*, plus korpus Tahap 1 untuk model yang dilayankan |
| `08_evaluasi_nlu.ipynb`          | Rancangan NLU berbasis aturan serta evaluasinya: akurasi, loss (0-1 & Hamming), dan F1-Score, pada teks acuan maupun teks hasil transkripsi |
---

## How to Run

Install dependency dan jalankan Jupyter Notebook:

```bash
pip install -r requirements.txt
jupyter notebook
```

Kemudian jalankan notebook sesuai urutan:
1. 01_cleaning_transactions.ipynb
2. 02_analysis_transactions.ipynb
3. 03_cleaning_audio.ipynb
4. 04_nlp_audio.ipynb
5. 05_ab_testing.ipynb
6. 06_training_ctc.ipynb
7. 07_evaluasi_cer_wer.ipynb
8. 08_evaluasi_nlu.ipynb

Notebook 07 dan 08 berpasangan: 07 menghasilkan berkas `transkripsi_<skenario>.csv`
yang dipakai 08 sebagai masukan NLU, jadi jalankan 07 lebih dulu. Keduanya
menulis hasil ke folder `hasil/` (lihat `hasil/README.md`).

Bila korpus Tahap 1 tersedia (`manifest_val.csv` + `wav/`), notebook 07 juga
mengevaluasi model Tahap 2 (v12) — satu-satunya angka CER/WER yang berlaku bagi
model yang benar-benar berjalan di aplikasi — dan notebook 08 memakai hasilnya
untuk menguji NLU pada ucapan sepotong. Pemisahan pada korpus itu per rekaman
sumber, bukan per penutur, jadi angkanya *speaker-dependent* pada rekaman baru.

Notebook 07 memerlukan **dua checkpoint**: satu hasil pelatihan skema
*speaker-dependent* dan satu hasil skema *speaker-independent*. Bila salah satu
belum ada, notebook hanya melaporkan skenario yang checkpoint-nya tersedia.
---

## Dataset Documentation

Detail dataset, preprocessing, definisi variabel, serta karakteristik data tersedia pada:

`data_dictionary.md`

---

## Comprehensive Report
Dokumen ini menjelaskan secara rinci setiap tahapan analisis data yang dilakukan dalam project.
🔗 **View Report:** [Google Drive Link](https://drive.google.com/file/d/1tpCK65ZhvTN2tGw2_13QvLoUaAEBpER7/view?usp=sharing)

---

## Dashboard

Dashboard Streamlit untuk visualisasi transaksi tersedia pada folder:

`dashboard/`

🔗 **Live Dashboard:** [Klik di sini untuk melihat dashboard](https://sales-dashboard-capstone.streamlit.app/)

Untuk menjalankan secara lokal, lihat dokumentasi di bagian “Run Dashboard Locally”.
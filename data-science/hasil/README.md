# Hasil Evaluasi

Folder ini menampung keluaran notebook evaluasi. Isinya dibuat ulang setiap kali
notebooknya dijalankan, jadi tidak perlu disunting manual.

## `evaluasi_asr/` — dari `notebooks/07_evaluasi_cer_wer.ipynb`

| berkas | isi |
|---|---|
| `tabel_cer_wer.csv` / `.md` | tabel utama CER & WER per skenario, lengkap dengan selang kepercayaan |
| `transkripsi_speaker_dependent.csv` | hipotesis dan acuan per ucapan, skenario *speaker-dependent* |
| `transkripsi_speaker_independent.csv` | hipotesis dan acuan per ucapan, skenario *speaker-independent* |
| `cer_per_penutur.csv` / `.png` | CER dan WER dirinci per penutur |
| `pemeriksaan_kebocoran.csv` | jumlah kebocoran penutur dan varian augmentasi pada data uji |
| `latensi_model.csv` | waktu ekstraksi fitur dan inferensi per ucapan |
| `perbandingan_cer_wer.png` | grafik perbandingan antar skenario |
| `ringkasan_evaluasi.json` | seluruh angka di atas dalam satu berkas, termasuk checkpoint yang dipakai |
| `transkripsi_tahap1_val.csv` | hipotesis model Tahap 2 (v12) atas klip validasi korpus Tahap 1 |
| `cer_wer_tahap1_val.csv` | CER & WER korpus Tahap 1, dirinci per bentuk ucapan dan kondisi akustik |

Berkas `transkripsi_*.csv` adalah masukan bagi notebook 08 — termasuk
`transkripsi_tahap1_val.csv`, yang membuat NLU ikut diuji pada ucapan sepotong.

## `evaluasi_nlu/` — dari `notebooks/08_evaluasi_nlu.ipynb`

| berkas | isi |
|---|---|
| `metrik_nlu.csv` / `.md` | akurasi, F1 macro/weighted intent, F1 entitas, akurasi gabungan per kondisi masukan |
| `metrik_slot.csv` | TP/FP/FN, presisi, recall, F1 per entitas (produk, jumlah, harga) |
| `metrik_per_intent.csv` | presisi, recall, dan F1 tiap kelas intent |
| `loss_nlu.csv` | 0-1 loss dan Hamming loss per kondisi |
| `kesalahan_per_slot.csv` | frekuensi kesalahan tiap slot |
| `sensitivitas_ambang.csv` / `.png` | pengaruh ambang kemiripan produk terhadap F1 dan salah terima |
| `prediksi_nlu_<kondisi>.csv` | hasil penguraian per ucapan, acuan berdampingan dengan prediksi |
| `matriks_kebingungan_intent.png`, `metrik_nlu.png` | grafik untuk laporan |
| `metrik_per_varian_tahap1.csv` | akurasi tiap slot per bentuk ucapan (produk / intent+produk / produk+qty / kalimat penuh) dan per kondisi akustik |
| `akurasi_per_varian_tahap1.png` | grafik akurasi gabungan per bentuk ucapan |
| `ringkasan_nlu.json` | seluruh metrik dalam satu berkas |

# Pengukuran unjuk kerja layanan (BAB 4, Sub-bab 4.3)

Tiga skrip untuk mengisi Tabel 4.17–4.20 pada naskah tugas akhir. Panduan prosedur
pengukurannya berupa dokumen terpisah dan tidak disertakan di repositori ini.

| Skrip | Untuk | Keluaran |
|---|---|---|
| `rekam.py` | Merekam 12 ucapan nama produk per kondisi (4 jarak × 3 kondisi derau) | berkas WAV 16 kHz + `manifest.csv` |
| `ukur_kondisi.py` | SNR, CER, WER, dan akurasi produk tiap kondisi | Tabel 4.18, 4.19, 4.20 + `hasil_kondisi.csv`, `ringkasan_kondisi.csv` |
| `ukur_waktu.py` | Waktu tanggap p50/p95 tiap lapisan | Tabel 4.17 + `waktu_tanggap.csv` |

Dijalankan dari folder `ai-service`:

```bash
./venv/bin/python pengukuran/rekam.py --daftar-perangkat
./venv/bin/python pengukuran/rekam.py --jarak 10 --derau sunyi --perangkat 0
./venv/bin/python pengukuran/ukur_kondisi.py --dir ~/finsense_pengukuran
./venv/bin/python pengukuran/ukur_waktu.py --audio <salah satu rekaman>.wav --ulang 50
```

Catatan: `ukur_kondisi.py` memuat `serve_model.py`, sehingga angkanya berasal dari jalur
keputusan yang sama dengan yang dilayankan. `ukur_waktu.py` membaca bidang waktu yang sudah
dikembalikan layanan (`waktu_inferensi_ms`, `response_time_ms`, `backend_response_time_ms`),
bukan perkiraan. Lapisan peramban diambil dari berkas HAR DevTools (`--har`) atau dari angka
"Waktu respons" pada popup aplikasi (`--peramban`).

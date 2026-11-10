# Tahap 1 — Korpus latih untuk ucapan sepotong

Dataset FinSense berisi **5100 rekaman manusia (6.3 jam)**. Penyebutannya sudah
cukup beragam:

| pola sesudah nama produk | jumlah |
|---|---|
| `QTY UNIT` — "dua bungkus" | 1599 |
| `QTY` saja, tanpa satuan — "enam" | 1557 |
| `QTY UNIT` + harga | 1194 |
| kosong — produk di akhir ucapan | 744 |

Kata intentnya pun lima: `jual` (1412), `tolong` (855), `keluar` (509),
`laku` (506), `beli` (339) — dan sebagian ucapan menyebut jumlah **sebelum**
nama produk ("empat glad two glow moisturizer").

Tapi 4356 dari 5100 ucapan masih menyebut produk di **tengah** kalimat, jadi
model kurang terlatih pada ucapan yang berhenti tepat di nama produk.

Tahap 1 memperbaiki itu **tanpa merekam ulang apa pun**. Dengan forced alignment
kita tahu frame ke berapa tiap kata diucapkan, jadi satu rekaman bisa dipanen
menjadi beberapa klip latih — semuanya audio manusia asli, dengan label yang
pasti benar karena transkrip acuannya sudah diketahui.

## Alur

```
rekaman kalimat penuh + transkrip acuan
        │
        ├─ ctc_align.py      forced alignment (Viterbi CTC) → batas tiap kata
        │
        ├─ build_corpus.py   potong jadi 4 varian × augmentasi acak
        │                    ↳ manifest.csv + manifest_train.csv + manifest_val.csv
        │
        └─ verify_corpus.py  cek label vs audio sebelum membuang jam GPU
```

## Varian yang dihasilkan

Semuanya rentang kata yang **bersambung** di rekaman aslinya — tidak ada
penyambungan audio yang menghasilkan potongan tak wajar.

| varian | label | porsi rencana |
|---|---|---|
| `produk` | `abc kecap asin enam ratus dua puluh mililiter` | 40% |
| `full` | kalimat penuh seperti aslinya | 20% |
| `intent_produk` | `jual abc kecap asin ...` | 20% |
| `produk_qty` | `abc kecap asin ... dua bungkus` | 20% |

Peran tiap kata ditemukan dengan mencari rentang kata terpanjang yang persis
sama dengan salah satu dari 121 nama produk, lalu menafsirkan sisanya di kiri
dan kanan. Penjangkaran kosakata ini menemukan produk pada **5100 dari 5100**
transkrip; pencocokan pola kalimat yang saya coba lebih dulu hanya dapat 2799.

Kalau peran yang diminta tidak ada di sebuah ucapan (744 ucapan tidak punya
qty; sebagian tidak punya kata intent), klipnya tetap dibuat tapi dilabeli ulang
sebagai `produk`, supaya komposisi di manifest tidak berbohong. Jadi porsi
sesungguhnya akan condong ke `produk` lebih banyak daripada rencana di atas.

## Augmentasi

Diterapkan dalam urutan yang meniru urutan fisiknya di dunia nyata: bicara →
ruangan → lingkungan → jarak mikrofon → kompresi browser → tombol ditekan lebih
awal.

| augmentasi | meniru | peluang |
|---|---|---|
| `silence` | jeda sebelum bicara setelah tombol mikrofon ditekan | 0.80 |
| `noise` | keramaian warung (pink noise + dengung jala-jala), SNR 5–20 dB | 0.60 |
| `speed` | tempo bicara berbeda (0.9×/1.0×/1.1×) | 0.50 |
| `gain` | jarak bicara ke mikrofon, −10..+6 dB | 0.50 |
| `opus` | rekaman WebM/Opus dari browser, 16–48 kbps | 0.50 |
| `reverb` | pantulan ruangan kecil, RT60 0.1–0.4 s | 0.35 |

`silence` diberi peluang tertinggi karena itulah kelemahan yang paling
langsung: pada uji internal, jeda 3 detik di depan menjatuhkan skor dari 90% ke
43%. `opus` sering terlewat padahal frontend memang mengirim WebM/Opus
sementara model dilatih pada WAV bersih.

## Menjalankan

Butuh venv `ai-service` (tensorflow + librosa) dan `ffmpeg`.

```bash
cd data-science/tahap1

# 1. bangun korpus
../../ai-service/venv/bin/python build_corpus.py \
    --audio-dir <dir berisi wav sumber> \
    --transcripts <csv filename,transcript> \
    --out <dir keluaran>

# 2. verifikasi sebelum melatih
../../ai-service/venv/bin/python verify_corpus.py --corpus <dir keluaran>
```

Dari 5100 berkas, `--dedup-augmented` (default) menyaring jadi 2500 rekaman unik
dan menghasilkan 12.500 klip (14.2 jam, 1.6 GB sebagai WAV). `--format flac`
kira-kira separuh ukurannya, sama-sama lossless dan sama-sama terbaca librosa.

**Jangan menulis korpus ke `~/Documents` atau `~/Desktop`.** Keduanya tersinkron
iCloud; saat disk menipis macOS meng-evict berkas yang baru ditulis dalam
hitungan menit, dan tiap pembacaan saat training akan memicu unduhan yang
di-throttle (~8.7 detik per berkas). Pada percobaan pertama, 2945 dari 12.500
klip sudah ter-evict sebelum verifikasi sempat jalan.

## Membaca hasil verifikasi

- **Klip bersih** adalah pemeriksaan label yang sesungguhnya. Di bawah 85%
  berarti alignment-nya meleset — perbaiki dulu, jangan dilatih.
- **Klip teraugmentasi** memang dirancang sulit bagi model sekarang. Angka yang
  lebih rendah di sini justru bukti augmentasinya menggigit. Yang
  mengkhawatirkan adalah kalau selisihnya tipis: berarti augmentasinya terlalu
  lembut dan korpusnya tidak menambah apa pun.

Hasil pada korpus penuh (2500 rekaman → 12.500 klip, sampel acak 4000):

| | klip bersih | teraugmentasi |
|---|---|---|
| gaya template (berkas bernomor) | 98.5% (n=408) | 71.4% (n=1528) |
| gaya bebas (`gen_*`) | 98.0% (n=440) | 79.6% (n=1624) |
| **keseluruhan** | **98.2%** (n=848) | 75.6% (n=3152) |

CER transkrip greedy: 10.2% bersih → 25.5% teraugmentasi.

Yang penting dari tabel itu: alignment sama akuratnya pada gaya bebas (98.0%)
seperti pada gaya template (98.5%). Jadi penjangkaran kosakata benar-benar
menangani `tolong`, jumlah tanpa satuan, dan jumlah di depan produk — bukan cuma
lolos di uji unit.

## Batas jendela 8 detik

8% rekaman (410 dari 5100) lebih panjang dari jendela masukan model. Untuk klip
itu rentang **katanya** yang dipangkas dari belakang — harga dulu, lalu qty —
bukan audionya. Kalau audionya yang dipotong, labelnya akan menjanjikan kata
yang tidak ada di rekaman, dan CTC akan mempelajari kekeliruan itu dengan patuh.
Kerusakan seperti itu tidak terlihat dari statistik durasi mana pun.

Kalau `max_frames` diperbesar saat Tahap 2, pemangkasan ini otomatis berkurang.

## Yang tidak bisa diperbaiki pipeline ini

Memanen ulang rekaman lama menambah variasi *bentuk kalimat*, bukan variasi
*penutur*. Kalau 5100 rekaman itu berasal dari sedikit orang, korpus hasilnya
tetap sedikit penutur. Untuk itu tidak ada jalan pintas — perlu rekaman dari
lebih banyak orang, idealnya langsung lewat mikrofon HP di lingkungan warung
yang sebenarnya.

Pelatihan ulangnya sendiri adalah Tahap 2.

# Data Dictionary

## Deskripsi Dataset

Project ini menggunakan dua sumber data utama, yaitu dataset transaksi retail *(structured data)* dan dataset audio transaksi *(unstructured data)* untuk mendukung analisis penjualan serta pengembangan sistem pencatatan transaksi berbasis *voice input*.

Dataset transaksi digunakan untuk exploratory data analysis (EDA), visualisasi data, forecasting, maupun pengembangan model machine learning. Selain itu, dataset transaksi juga digunakan sebagai dasar pembentukan data transkrip dan pelabelan NLP *(Natural Language Processing)* guna merepresentasikan transaksi dalam format teks untuk kebutuhan sistem berbasis suara. Dataset ini telah melalui proses data cleaning, transformasi data, agregasi penjualan harian, simulasi inventori, dan penggabungan data stok sehingga menghasilkan dataset transaksi final yang lebih terstruktur.

Sementara itu, dataset audio digunakan untuk mendukung fitur pencatatan transaksi berbasis suara melalui proses preprocessing audio berupa mono conversion, resampling, normalization, dan silence trimming agar kualitas audio menjadi lebih konsisten sebelum digunakan pada proses transkripsi suara.

---

# 1. Dataset Transactions

## Deskripsi Dataset

Dataset ini berisi data transaksi penjualan produk retail di Indonesia yang telah melalui proses data cleaning, transformasi data, agregasi penjualan harian, serta penambahan simulasi inventori.

Dataset akhir terdiri dari 63.161 baris dan 10 kolom tanpa missing value sehingga siap digunakan untuk exploratory data analysis (EDA), visualisasi data, forecasting, maupun pengembangan model machine learning.

### Proses Preprocessing Data

Beberapa tahapan preprocessing yang dilakukan pada dataset meliputi:

#### 1. Data Cleaning
- Menghapus kolom yang tidak digunakan, seperti:
  - `Unnamed`
  - `Payment_Method`
  - `Store_Location`
  - `Unit Cost`
- Mengubah tipe data:
  - `Date` → `datetime`
  - `Revenue` → `float`
  - `Category` → `category`
- Mengubah format harga menjadi rupiah
- Melakukan standarisasi nama produk:
  - `Tolako Minuman Herbal` → `Tolak Linu`
  - `Indomilk UHT 1L` → `Indomilk UHT Full Cream 1L`

#### 2. Data Transformation
- Menambahkan kategori produk baru:
  - `Bakery`
  - `Home`
  - `Make Up`
- Mengubah kategori pada beberapa produk baru
- Melakukan agregasi penjualan harian berdasarkan:
  - `Date`
  - `Province`
  - `Product_Name`

#### 3. Feature Engineering
- Membuat kolom `Transaction_ID` sebagai identitas unik transaksi
- Menambahkan fitur simulasi inventori:
  - `Stock_In`
  - `Stock_Out`
  - `Stock_End`

#### 4. Stock Simulation
Simulasi inventori dilakukan menggunakan beberapa aturan berikut:
- Restock awal untuk setiap produk
- Restock terjadwal setiap hari Senin dan Kamis
- Restock darurat ketika stok tidak mencukupi
- Batas maksimum stok sebesar 1000 unit

#### 5. Data Merging
Dataset transaksi dan dataset stok digabung berdasarkan:
- `Date`
- `Product_Name`

---

### Kolom Dataset Final

| Nama Kolom | Tipe Data | Deskripsi | Contoh Nilai |
|---|---|---|---|
| Transaction_ID | object | ID unik untuk setiap transaksi | TRX000001 |
| Date | datetime64[ns] | Tanggal transaksi penjualan | 2023-01-01 |
| Product_Name | object | Nama produk yang dijual | ABC Kecap Asin 620ml |
| Category | category | Kategori produk | Groceries |
| Units_Sold | int64 | Jumlah unit produk yang terjual | 47 |
| Unit_Price | float64 | Harga per unit produk dalam rupiah | 18000 |
| Revenue | float64 | Total pendapatan transaksi | 846000 |
| Stock_In | int64 | Jumlah stok masuk akibat proses restock | 627 |
| Stock_Out | int64 | Jumlah stok keluar akibat penjualan | 47 |
| Stock_End | int64 | Jumlah stok akhir produk setelah transaksi | 580 |

---

### Variabel dalam Analisis

| Nama Variabel | Deskripsi | Rumus / Metode |
|---|---|---|
| Revenue | Total pendapatan transaksi | Units_Sold × Unit_Price |
| Stock_Out | Jumlah stok keluar akibat penjualan | Sama dengan Units_Sold |
| Stock_End | Jumlah stok akhir produk setelah proses restock dan penjualan | Stok sebelumnya + Stock_In − Stock_Out |
| Daily Sales | Total penjualan harian produk | Agregasi berdasarkan tanggal dan produk |

---

### Informasi Dataset

| Informasi | Nilai |
|---|---|
| Jumlah Baris | 63.161 |
| Jumlah Kolom | 10 |
| Missing Value | Tidak ada |
| Format Dataset | CSV |
| Dataset Final | `transactions_clean.csv` |
| Jenis Dataset | Structured Data |
| Domain Dataset | Retail Sales |

---

# 2. Dataset Transcripts

## Deskripsi Dataset

Dataset transkrip merupakan hasil pembentukan kalimat transaksi berbasis teks yang dihasilkan dari dataset transaksi retail untuk mendukung pengembangan sistem pencatatan transaksi berbasis *voice input*.

Dataset dibentuk melalui proses penyesuaian nama produk, konversi angka dan satuan ke bentuk teks, pembentukan variasi transaksi berdasarkan jumlah pembelian, penggunaan variasi penyebutan transaksi (`jual`, `laku`, `keluar`), serta penyusunan kalimat hasil transkrip agar lebih terstruktur.

### Karakteristik Dataset Transcript

| Karakteristik | Deskripsi |
|---|---|
| Format Dataset | CSV |
| Dataset Final | `transcripts.csv` |
| Jenis Dataset | Structured Data |
| Bahasa | Bahasa Indonesia |
| Fungsi Dataset | Referensi transkrip untuk sistem *voice input* |

### Kolom Dataset

| Nama Kolom | Tipe Data | Deskripsi | Contoh Nilai |
|---|---|---|---|
| filename | object | Nama file audio yang terhubung dengan transkrip | `1.wav` |
| transcript | object | Kalimat transaksi hasil pembentukan transkrip | `jual kecap asin enam ratus dua puluh mililiter satu bungkus delapan belas ribu` |

# 3. Dataset NLP

## Deskripsi Dataset

Dataset NLP *(Natural Language Processing)* merupakan hasil pelabelan transkrip transaksi dengan menambahkan informasi *intent* dan *entity* untuk mendukung sistem pencatatan transaksi berbasis *voice input*.

Dataset dibentuk dari transkrip transaksi melalui proses identifikasi jenis transaksi *(intent)* dan ekstraksi informasi penting *(entity)*, seperti nama produk, jumlah pembelian, dan harga, sehingga data menjadi lebih terstruktur dan siap digunakan pada proses pemodelan maupun pengembangan sistem berbasis suara.

### Karakteristik Dataset NLP

| Karakteristik | Deskripsi |
|---|---|
| Format Dataset | CSV |
| Dataset Final | `nlu_labeled.csv` |
| Jenis Dataset | Structured Data |
| Bahasa | Bahasa Indonesia |
| Fungsi Dataset | Pelabelan *intent* dan *entity* transaksi |

### Kolom Dataset

| Nama Kolom | Tipe Data | Deskripsi | Contoh Nilai |
|---|---|---|---|
| filename | object | Nama file audio yang terhubung dengan transkrip | `1.wav` |
| transcript | object | Kalimat transaksi hasil transkrip | `jual kecap asin enam ratus dua puluh mililiter satu bungkus delapan belas ribu` |
| intent | object | Jenis transaksi berdasarkan kata awal pada kalimat | `jual` |
| entities | object | Informasi hasil ekstraksi transaksi | `produk, jumlah, harga` |

# 4. Dataset Audio

## Deskripsi Dataset

Dataset audio terdiri dari **1.200 file audio** berformat WAV yang berisi rekaman suara input transaksi untuk mendukung sistem pencatatan transaksi berbasis suara.

Dataset digunakan pada proses preprocessing audio, transkripsi suara, serta pengembangan sistem voice-based transaction input.

### Proses Preprocessing Data

#### 1. Mono Conversion

Mengubah audio menjadi satu channel (mono)

#### 2. Resampling

Menyeragamkan sample rate menjadi `16 kHz`

#### 3. Audio Normalization

Menstabilkan volume audio

#### 4. Silence Trimming

Menghapus bagian hening pada awal dan akhir audio

### Karakteristik Dataset Audio
| Karakteristik | Deskripsi|
|---|---|
| Format File | WAV (.wav) |
| Jumlah File Audio | 1.200 |
| Struktur Dataset | Folder Audio |
| Audio Channel Final | Mono (1 channel) |
| Sample Rate Final | 16 kHz |
| Bahasa Audio | Bahasa Indonesia |
| Preprocessing | Mono conversion, resampling, normalization, silence trimming |
| Dataset Final | `audio_raw/` |
| Jenis Dataset | Unstructured Data |

### Struktur Penyimpanan Dataset

```text
audio_raw/
├── 1.wav
├── 2.wav
├── 3.wav
...
├── 1200.wav
```

---

## Catatan Tambahan

- Dataset transaksi akhir merupakan hasil penggabungan antara dataset transaksi dan dataset stok inventori.
- Kolom inventori (`Stock_In`, `Stock_Out`, dan `Stock_End`) merupakan hasil simulasi berdasarkan aturan restock dan aktivitas penjualan produk.
- Dataset transaksi telah melalui proses data cleaning, transformasi data, agregasi penjualan harian, simulasi inventori, serta penggabungan dataset sebelum digunakan pada tahap analisis.
- Dataset transkrip (`transcripts.csv`) dibentuk dari dataset transaksi melalui proses penyesuaian nama produk, konversi angka dan satuan ke bentuk teks, serta pembentukan variasi kalimat transaksi.
- Dataset NLP (`nlu_labeled.csv`) merupakan hasil pelabelan transkrip dengan menambahkan informasi *intent* dan *entity* untuk mendukung pengembangan sistem pencatatan transaksi berbasis *voice input*.
- Dataset audio digunakan untuk mendukung sistem pencatatan transaksi berbasis *voice input* dan telah melalui preprocessing berupa mono conversion, resampling (`16 kHz`), audio normalization, dan silence trimming guna meningkatkan konsistensi kualitas suara.
- Dataset transaksi digunakan untuk exploratory data analysis (EDA), visualisasi data, forecasting, maupun pengembangan model machine learning.
- Dataset audio, transkrip, dan NLP digunakan untuk mendukung pengembangan sistem pencatatan transaksi berbasis suara.


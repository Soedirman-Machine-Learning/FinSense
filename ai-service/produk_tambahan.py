"""
FinSense — produk tambahan dari database web untuk rescoring leksikon CTC
=========================================================================

Rescoring (ctc_lexicon.LexiconRescorer) hanya bisa memilih nama yang ada di
daftar kandidatnya. Daftar bawaannya 121 produk dari model_v10/
unit_price_lookup.json, sedangkan produk yang ditambahkan kasir lewat web hanya
masuk ke database. Modul ini menjembatani keduanya: backend mengirim daftar
produk database pada setiap permintaan suara, lalu nama yang belum ada di 121
produk bawaan ikut diskor sebagai kandidat. Tidak ada pelatihan ulang dan tidak
perlu restart layanan.

Rescoring bekerja per karakter terhadap posteriorgram, jadi nama kandidat harus
ditulis seperti DIUCAPKAN, sama dengan gaya 121 nama bawaan ("aqua enam ratus
mililiter"). Nama yang diketik di web ("Aqua 600ml") karena itu diubah dulu ke
bentuk ucapannya: huruf kecil, angka dieja dalam bahasa Indonesia, singkatan
satuan dipanjangkan, tanda baca dibuang.

Bila backend tidak mengirim apa pun, hasilnya kamus kosong dan seluruh jalur
keputusan berjalan persis seperti sebelumnya. Itulah yang menjaga angka
evaluasi skripsi: skrip evaluasi tidak pernah mengirim produk tambahan.
"""

from __future__ import annotations

import json
import re
import unicodedata
from typing import Iterable, NamedTuple

_ANGKA = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima',
          'enam', 'tujuh', 'delapan', 'sembilan']

# (nilai, nama, bentuk "se-" untuk tepat satu). Dicoba dari yang terbesar.
_SKALA = (
    (10 ** 12, 'triliun', None),
    (10 ** 9, 'miliar', None),
    (10 ** 6, 'juta', None),
    (1000, 'ribu', 'seribu'),
    (100, 'ratus', 'seratus'),
)

# Singkatan satuan yang hanya dipanjangkan bila mengikuti angka ("350 g"),
# karena berdiri sendiri huruf seperti "l" atau "g" bisa saja bagian nama.
_SATUAN_SETELAH_ANGKA = {
    'ml': 'mililiter', 'l': 'liter', 'lt': 'liter', 'ltr': 'liter',
    'g': 'gram', 'gr': 'gram', 'grm': 'gram', 'kg': 'kilogram',
    'mg': 'miligram', 'cm': 'sentimeter', 'mm': 'milimeter', 'm': 'meter',
}
# Singkatan yang tidak mungkin berarti lain, dipanjangkan di mana pun.
_SATUAN_SELALU = {k: _SATUAN_SETELAH_ANGKA[k] for k in ('ml', 'ltr', 'gr', 'kg', 'mg')}

_RIBUAN_TITIK = re.compile(r'^\d{1,3}(\.\d{3})+$')
_RIBUAN_KOMA = re.compile(r'^\d{1,3}(,\d{3})+$')
_DESIMAL = re.compile(r'^(\d+)[.,](\d+)$')


def terbilang(n: int) -> str:
    """Bilangan bulat tak-negatif -> ejaan bahasa Indonesia ("seratus delapan puluh sembilan")."""
    if n < 10:
        return _ANGKA[n]
    if n == 10:
        return 'sepuluh'
    if n == 11:
        return 'sebelas'
    if n < 20:
        return f'{_ANGKA[n - 10]} belas'
    if n < 100:
        puluh, sisa = divmod(n, 10)
        return f'{_ANGKA[puluh]} puluh' + (f' {_ANGKA[sisa]}' if sisa else '')
    for nilai, nama, se in _SKALA:
        if n >= nilai:
            depan, sisa = divmod(n, nilai)
            kepala = se if (depan == 1 and se) else f'{terbilang(depan)} {nama}'
            return kepala + (f' {terbilang(sisa)}' if sisa else '')
    raise AssertionError('tidak terjangkau')


def _eja_angka(token: str) -> str:
    """Token angka apa adanya ("1.000", "1,5", "350") -> ejaannya."""
    if _RIBUAN_TITIK.match(token) or _RIBUAN_KOMA.match(token):
        return terbilang(int(re.sub(r'[.,]', '', token)))
    m = _DESIMAL.match(token)
    if m:
        return f"{terbilang(int(m.group(1)))} koma {' '.join(_ANGKA[int(d)] for d in m.group(2))}"
    digit = re.sub(r'[.,]', '', token)
    # Deret angka sangat panjang (kode barang) dibaca per digit, bukan sebagai bilangan.
    if len(digit) > 15:
        return ' '.join(_ANGKA[int(d)] for d in digit)
    return terbilang(int(digit))


def nama_ucapan(nama: str) -> str:
    """Nama produk seperti diketik di web -> bentuk ucapannya.

    "Teh Pucuk 350ml" -> "teh pucuk tiga ratus lima puluh mililiter".
    Idempoten pada 121 nama bawaan, yang memang sudah berbentuk ucapan.
    """
    teks = unicodedata.normalize('NFKD', str(nama)).encode('ascii', 'ignore').decode()
    teks = teks.lower().replace("'", '')
    teks = teks.replace('&', ' dan ').replace('%', ' persen ').replace('+', ' plus ')
    kata = []
    sebelumnya_angka = False
    for token in re.findall(r'\d+(?:[.,]\d+)*|[a-z]+', teks):
        if token[0].isdigit():
            kata.append(_eja_angka(token))
            sebelumnya_angka = True
            continue
        if sebelumnya_angka and token in _SATUAN_SETELAH_ANGKA:
            kata.append(_SATUAN_SETELAH_ANGKA[token])
        else:
            kata.append(_SATUAN_SELALU.get(token, token))
        sebelumnya_angka = False
    return ' '.join(kata)


class ProdukTambahan(NamedTuple):
    nama: str                 # nama asli di database, dikembalikan apa adanya ke backend
    harga: int | float        # harga satuan dari database


def siapkan_produk_tambahan(teks_json: str, katalog: Iterable[str],
                            batas: int) -> dict[str, ProdukTambahan]:
    """Field `produk_tambahan` dari backend -> {bentuk ucapan: ProdukTambahan}.

    teks_json berisi daftar [{"name": ..., "price": ...}]. Nama yang bentuk
    ucapannya sudah ada di katalog bawaan dilewati, sehingga 121 produk bawaan
    tetap dilayani persis seperti sebelumnya, termasuk harganya. Nama kembar
    hanya diambil yang pertama. Masukan rusak tidak menggagalkan permintaan:
    hasilnya kamus kosong dan layanan kembali ke 121 produk bawaan.
    """
    if not teks_json:
        return {}
    try:
        daftar = json.loads(teks_json)
    except ValueError:
        print('[PERINGATAN] produk_tambahan bukan JSON yang sah, diabaikan.', flush=True)
        return {}
    if not isinstance(daftar, list):
        return {}

    bawaan = set(katalog)
    hasil: dict[str, ProdukTambahan] = {}
    for item in daftar:
        if not isinstance(item, dict):
            continue
        nama = str(item.get('name') or '').strip()
        ucapan = nama_ucapan(nama)
        if not ucapan or ucapan in bawaan or ucapan in hasil:
            continue
        try:
            harga = max(float(item.get('price') or 0), 0.0)
        except (TypeError, ValueError):
            harga = 0.0
        hasil[ucapan] = ProdukTambahan(nama, int(harga) if harga.is_integer() else harga)
        if len(hasil) >= batas:
            print(f'[PERINGATAN] produk tambahan dibatasi {batas}; sisanya tidak diskor.',
                  flush=True)
            break
    return hasil

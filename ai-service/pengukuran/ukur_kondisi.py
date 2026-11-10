"""
Pengolah hasil pengukuran jarak dan derau (RM3)
===============================================

Membaca rekaman hasil pengukuran/rekam.py, menghitung SNR tiap rekaman, lalu
menjalankan setiap ucapan melalui jalur keputusan yang sama dengan yang
dilayankan (`serve_model.putuskan_transaksi`, mode model_only). Keluarannya
adalah angka siap salin untuk Tabel 4.18, 4.19, dan 4.20 pada naskah.

SNR dihitung sesuai rumus pada Sub-bab 3.4: daya rata-rata segmen ucapan dibagi
daya rata-rata segmen keheningan pada awal rekaman, dalam desibel. Segmen ucapan
dicari otomatis; keheningan diambil dari 1,2 detik pertama, yang pada prosedur
perekaman memang disisakan kosong.

Menjalankan (dari folder ai-service):
    ./venv/bin/python pengukuran/ukur_kondisi.py --dir ~/finsense_pengukuran

Berkas keluaran (di folder yang sama dengan manifest):
    hasil_kondisi.csv      satu baris per rekaman
    ringkasan_kondisi.csv  satu baris per kelompok, sama dengan yang dicetak
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '3')
os.environ['FINSENSE_ASR_MODE'] = 'model_only'

import numpy as np
import soundfile as sf

AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, AI)
HENING_AWAL_DETIK = 1.2
JARAK = (10, 20, 30, 40)
DERAU = ('sunyi', 'kipas', 'kendaraan')
NAMA_DERAU = {'sunyi': 'Sunyi', 'kipas': 'Derau kipas', 'kendaraan': 'Derau kendaraan'}


# ── metrik ───────────────────────────────────────────────────────────
def bersihkan(teks: str) -> str:
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z ]', '', str(teks).lower())).strip()


def jarak_edit(a, b) -> int:
    """Levenshtein untuk untai karakter (CER) atau daftar kata (WER)."""
    m, n = len(a), len(b)
    d = list(range(n + 1))
    for i in range(1, m + 1):
        prev, d[0] = d[0], i
        for j in range(1, n + 1):
            kini = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = kini
    return d[n]


def snr_db(path: str) -> tuple[float, float]:
    """(SNR dalam dB, durasi detik) dari satu rekaman."""
    y, sr = sf.read(path, dtype='float32')
    if y.ndim > 1:
        y = y.mean(axis=1)
    batas = int(HENING_AWAL_DETIK * sr)
    derau = y[:batas]
    daya = lambda x: float(np.mean(np.square(x)) + 1e-12)
    p_derau = daya(derau)

    # Segmen ucapan: bingkai 25 ms yang dayanya jauh di atas lantai derau.
    lebar, lompat = int(0.025 * sr), int(0.010 * sr)
    sisa = y[batas:]
    bingkai = [sisa[i:i + lebar] for i in range(0, max(len(sisa) - lebar, 0), lompat)]
    kuat = [b for b in bingkai if daya(b) > 4 * p_derau]
    p_ucapan = daya(np.concatenate(kuat)) if kuat else daya(sisa)
    return float(10 * np.log10(p_ucapan / p_derau)), len(y) / sr


# ── pengumpulan per rekaman ──────────────────────────────────────────
def olah(manifest: str, folder: str, lewati_model: bool) -> list[dict]:
    with open(manifest, encoding='utf-8') as f:
        data = list(csv.DictReader(f))
    if not data:
        sys.exit('manifest kosong')

    svc = None
    if not lewati_model:
        print('Memuat layanan (model + rescoring leksikon)…', flush=True)
        import serve_model as svc  # noqa: F811  (jalur yang sama dengan API)

    baris = []
    for i, d in enumerate(data, 1):
        path = os.path.join(folder, d['filename'])
        if not os.path.exists(path):
            print(f'  [LEWATI] berkas hilang: {d["filename"]}')
            continue
        snr, durasi = snr_db(path)
        acuan = bersihkan(d['teks'])

        if lewati_model:                       # mode uji tanpa TensorFlow
            hipotesis, produk, ditolak = acuan, bersihkan(d['produk']), False
        else:
            with open(path, 'rb') as f:
                feat = svc._decode_audio_bytes_fast(f.read(), svc.engine.audio_config)
            probs = svc._model_probs(feat)
            mentah = svc.ctc_greedy_decode(probs, svc.engine.idx2char, svc.engine.blank_idx)
            hipotesis = bersihkan(mentah)
            conf = svc.ctc_confidence(probs, svc.engine.blank_idx)
            hasil = svc.putuskan_transaksi(probs, mentah, conf, transcript='',
                                           jumlah_form=0, mode='model_only')
            top3 = hasil.get('produk_top3') or []
            ditolak = not hasil.get('success', False)
            produk = bersihkan(top3[0][0]) if top3 else ''

        baris.append({
            'filename': d['filename'], 'jarak_cm': int(d['jarak_cm']), 'derau': d['derau'],
            'produk_acuan': bersihkan(d['produk']), 'produk_prediksi': produk,
            'produk_benar': int((not ditolak) and produk == bersihkan(d['produk'])),
            'ditolak': int(ditolak), 'snr_db': round(snr, 2), 'durasi_detik': round(durasi, 2),
            'teks_acuan': acuan, 'transkrip': hipotesis,
            'galat_karakter': jarak_edit(acuan, hipotesis), 'n_karakter': len(acuan),
            'galat_kata': jarak_edit(acuan.split(), hipotesis.split()), 'n_kata': len(acuan.split()),
        })
        if i % 20 == 0 or i == len(data):
            print(f'  {i}/{len(data)} rekaman diolah', flush=True)
    return baris


# ── ringkasan ────────────────────────────────────────────────────────
def hitung(kel: list[dict]) -> dict:
    n = len(kel)
    jml = lambda k: sum(b[k] for b in kel)
    return {
        'n': n,
        'snr': np.mean([b['snr_db'] for b in kel]) if n else float('nan'),
        'cer': 100 * jml('galat_karakter') / max(jml('n_karakter'), 1),
        'wer': 100 * jml('galat_kata') / max(jml('n_kata'), 1),
        'produk': 100 * jml('produk_benar') / max(n, 1),
        'tolak': 100 * jml('ditolak') / max(n, 1),
    }


def koma(x: float, n: int = 2, satuan: str = '%') -> str:
    return ('—' if x != x else f'{x:.{n}f}'.replace('.', ',') + satuan)


def tabel(judul: str, kolom: list[str], baris: list[list[str]]) -> None:
    lebar = [max(len(str(b[i])) for b in [kolom] + baris) for i in range(len(kolom))]
    print('\n' + judul)
    print('  ' + '  '.join(k.ljust(lebar[i]) for i, k in enumerate(kolom)))
    print('  ' + '  '.join('-' * lebar[i] for i in range(len(kolom))))
    for b in baris:
        print('  ' + '  '.join(str(v).ljust(lebar[i]) for i, v in enumerate(b)))


def ringkas(baris: list[dict], out: str) -> None:
    def pilih(**syarat):
        return [b for b in baris if all(b[k] == v for k, v in syarat.items())]

    ekspor = []

    def deret(label: str, kel: list[dict], kelompok: str) -> list[str]:
        h = hitung(kel)
        ekspor.append({'kelompok': kelompok, 'label': label, **{k: round(v, 2) for k, v in h.items()}})
        if not h['n']:
            return [label, '0', '—', '—', '—', '—']
        return [label, str(h['n']), koma(h['snr'], 1, ' dB'), koma(h['cer']), koma(h['wer']), koma(h['produk'])]

    kolom = ['Baris', 'Jumlah ucapan', 'SNR terukur', 'CER', 'WER', 'Akurasi produk']
    tabel('TABEL 4.18 — Pengaruh Jarak Mikrofon (seluruh kondisi derau digabung)', kolom,
          [deret(f'{j} cm', pilih(jarak_cm=j), 'jarak') for j in JARAK])
    tabel('TABEL 4.19 — Pengaruh Kondisi Derau (seluruh jarak digabung)', kolom,
          [deret(NAMA_DERAU[d], pilih(derau=d), 'derau') for d in DERAU])

    kolom20 = ['Jarak'] + [NAMA_DERAU[d] for d in DERAU]
    baris20 = []
    for j in JARAK:
        sel = []
        for d in DERAU:
            h = hitung(pilih(jarak_cm=j, derau=d))
            ekspor.append({'kelompok': 'matriks', 'label': f'{j} cm × {NAMA_DERAU[d]}',
                           **{k: round(v, 2) for k, v in h.items()}})
            sel.append(f'{koma(h["produk"])} (n={h["n"]})' if h['n'] else '—')
        baris20.append([f'{j} cm'] + sel)
    tabel('TABEL 4.20 — Matriks Jarak terhadap Kondisi Derau (akurasi produk; n per sel)', kolom20, baris20)

    # Varian terkendali: satu faktor dikunci. Berguna bila pembimbing meminta
    # baris tabel yang tidak mencampur pengaruh faktor lain.
    tabel('Varian terkendali — jarak pada kondisi sunyi saja', kolom,
          [deret(f'{j} cm (sunyi)', pilih(jarak_cm=j, derau='sunyi'), 'jarak_sunyi') for j in JARAK])
    tabel('Varian terkendali — derau pada jarak 30 cm saja', kolom,
          [deret(f'{NAMA_DERAU[d]} (30 cm)', pilih(derau=d, jarak_cm=30), 'derau_30cm') for d in DERAU])

    keseluruhan = hitung(baris)
    ekspor.append({'kelompok': 'keseluruhan', 'label': 'Seluruh rekaman',
                   **{k: round(v, 2) for k, v in keseluruhan.items()}})
    print(f'\nSeluruh rekaman: n={keseluruhan["n"]} · SNR {koma(keseluruhan["snr"], 1, " dB")} · '
          f'CER {koma(keseluruhan["cer"])} · WER {koma(keseluruhan["wer"])} · '
          f'akurasi produk {koma(keseluruhan["produk"])} · ditolak {koma(keseluruhan["tolak"])}')

    with open(out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['kelompok', 'label', 'n', 'snr', 'cer', 'wer', 'produk', 'tolak'])
        w.writeheader(); w.writerows(ekspor)
    print(f'\nRingkasan tersimpan: {out}')


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dir', default='~/finsense_pengukuran', help='folder berisi manifest.csv')
    ap.add_argument('--lewati-model', action='store_true',
                    help='hanya hitung SNR (untuk memeriksa rekaman tanpa memuat model)')
    args = ap.parse_args()

    folder = os.path.expanduser(args.dir)
    manifest = os.path.join(folder, 'manifest.csv')
    if not os.path.exists(manifest):
        sys.exit(f'manifest tidak ditemukan: {manifest}')

    baris = olah(manifest, folder, args.lewati_model)
    if not baris:
        sys.exit('tidak ada rekaman yang dapat diolah')

    rinci = os.path.join(folder, 'hasil_kondisi.csv')
    with open(rinci, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(baris[0].keys()))
        w.writeheader(); w.writerows(baris)
    print(f'\nRincian per rekaman tersimpan: {rinci}')
    if args.lewati_model:
        print('CATATAN: --lewati-model aktif, angka CER/WER/akurasi produk belum sah.')
    ringkas(baris, os.path.join(folder, 'ringkasan_kondisi.csv'))


if __name__ == '__main__':
    main()

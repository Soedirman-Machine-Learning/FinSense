"""
Eval mode ASR — sistem dengan vs tanpa ASR pihak ketiga
=======================================================

Menjawab satu pertanyaan: kalau transkrip Web Speech API (ASR bawaan browser,
milik Google) dicabut, seberapa jauh kinerja pencatatan turun?

Dua mode dijalankan atas AUDIO YANG SAMA, lewat fungsi keputusan yang sama
dengan yang dilayankan (`serve_model.putuskan_transaksi`), sehingga angkanya
bukan hasil simulasi ulang yang bisa menyimpang dari perilaku aplikasi:

  model_only   transkrip browser diabaikan. Produk, jumlah, dan harga
               seluruhnya dari model CNN-BiGRU-CTC sistem ini.
  hybrid       transkrip browser dipakai sebagai sumber jumlah yang
               didahulukan dan sebagai cadangan saat audio tidak cocok dengan
               produk mana pun.

PENTING — bagaimana transkrip browser disimulasikan. Menjalankan Web Speech
atas ribuan klip butuh Chrome dan koneksi, jadi di sini mode hybrid diberi
**teks acuan** sebagai transkrip browsernya. Itu bukan kecurangan selama
dibaca dengan benar: ia adalah **batas atas** bagi mode hybrid — seolah ASR
pihak ketiga bekerja sempurna, tanpa satu pun salah eja. Jadi selisih yang
terukur adalah selisih TERBURUK yang mungkin terjadi bila Web Speech dicabut.
Kalau model_only sudah mendekati batas atas itu, mencabutnya aman.

Label acuan dibangun dengan penjangkaran kosakata terhadap katalog produk —
prosedur yang sama dengan notebook 08 — bukan dengan parser yang sedang dinilai.

Menjalankan:
    ./venv/bin/python eval_mode_asr.py \\
        --transcripts <dir dataset>/transcripts_expanded.csv \\
        --audio-dir   <dir dataset>/audio \\
        --limit 300

    # atau atas korpus Tahap 1 (klip ucapan sepotong):
    ./venv/bin/python eval_mode_asr.py \\
        --manifest ~/finsense_tahap1/manifest_val.csv \\
        --audio-dir ~/finsense_tahap1/wav
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '3')
# Mode diberikan eksplisit per pemanggilan, jadi nilai env tidak boleh ikut
# menentukan hasil evaluasi.
os.environ['FINSENSE_ASR_MODE'] = 'model_only'

import numpy as np


# ─────────────────────────────────────────────────────────────────────
# Label acuan
# ─────────────────────────────────────────────────────────────────────
BILANGAN = {'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5,
            'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9, 'sepuluh': 10}
SKALA = {'ratus', 'puluh', 'belas', 'ribu', 'juta', 'seratus', 'seribu', 'sebelas'}


def bersihkan(teks: str) -> str:
    teks = str(teks).lower().strip()
    teks = re.sub(r'[^a-z ]', '', teks)
    return re.sub(r'\s+', ' ', teks)


def buat_penjangkar(produk_vocab):
    """Kembalikan fungsi teks -> (nama produk, indeks awal, indeks akhir).

    Nama terpanjang dicoba lebih dulu: beberapa nama adalah awalan nama lain
    ("kecap asin ..." ada di dalam "abc kecap asin ..."), dan tanpa pengurutan
    penjangkaran bisa berhenti pada potongan yang lebih pendek.
    """
    urut = sorted({bersihkan(p) for p in produk_vocab}, key=lambda p: -len(p.split()))

    def jangkar(kata_kata):
        for nama in urut:
            pola = nama.split()
            n = len(pola)
            for i in range(len(kata_kata) - n + 1):
                if kata_kata[i:i + n] == pola:
                    return nama, i, i + n
        return None, -1, -1

    return jangkar


def label_acuan(teks: str, jangkar) -> dict:
    """Produk dan jumlah sebenarnya dari sebuah transkrip acuan."""
    kata = bersihkan(teks).split()
    produk, awal, akhir = jangkar(kata)
    luar = (kata[:awal] + kata[akhir:]) if produk else list(kata)
    # Kata bilangan pertama di luar nama produk. Kata bilangan sesudahnya adalah
    # bagian nominal harga ("dua puluh empat ribu").
    jumlah = next((BILANGAN[w] for w in luar if w in BILANGAN), None)
    return {'produk': produk, 'jumlah': jumlah}


# ─────────────────────────────────────────────────────────────────────
# Pemuatan data
# ─────────────────────────────────────────────────────────────────────
def baca_daftar(args) -> list[dict]:
    sumber = args.manifest or args.transcripts
    with open(os.path.expanduser(sumber), encoding='utf-8') as f:
        baris = list(csv.DictReader(f))
    kolom_teks = 'transcript' if 'transcript' in baris[0] else 'teks'
    data = [{'filename': b['filename'], 'teks': bersihkan(b[kolom_teks])} for b in baris]
    if args.limit:
        rng = np.random.RandomState(args.seed)
        pilih = rng.choice(len(data), size=min(args.limit, len(data)), replace=False)
        data = [data[i] for i in sorted(pilih)]
    return data


# ─────────────────────────────────────────────────────────────────────
# Evaluasi
# ─────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--transcripts', help='CSV berkolom filename,transcript')
    ap.add_argument('--manifest', help='manifest korpus Tahap 1 (filename,transcript,...)')
    ap.add_argument('--audio-dir', required=True)
    ap.add_argument('--limit', type=int, default=0, help='0 = seluruh data')
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--out', default='hasil_mode_asr.csv')
    args = ap.parse_args()
    if not (args.transcripts or args.manifest):
        ap.error('sediakan --transcripts atau --manifest')

    print('Memuat layanan (model + rescoring leksikon)…', flush=True)
    import serve_model as svc   # memuat model sekali; jalur yang sama dengan API

    audio_dir = os.path.expanduser(args.audio_dir)
    data = baca_daftar(args)
    jangkar = buat_penjangkar(svc.engine.produk_vocab)
    print(f'Ucapan dievaluasi : {len(data):,}')
    print(f'Audio             : {audio_dir}')
    print(f'Katalog           : {len(svc.engine.produk_vocab)} produk\n')

    baris = []
    t0 = time.time()
    for i, d in enumerate(data, 1):
        jalur = os.path.join(audio_dir, d['filename'])
        try:
            with open(jalur, 'rb') as f:
                feat = svc._decode_audio_bytes_fast(f.read(), svc.engine.audio_config)
        except Exception as e:                      # berkas hilang / rusak
            print(f'  [LEWATI] {d["filename"]}: {e}', flush=True)
            continue

        probs = svc._model_probs(feat)
        raw_text = svc.ctc_greedy_decode(probs, svc.engine.idx2char, svc.engine.blank_idx)
        ctc_conf = svc.ctc_confidence(probs, svc.engine.blank_idx)
        acuan = label_acuan(d['teks'], jangkar)

        catatan = {'filename': d['filename'], 'teks_acuan': d['teks'],
                   'transkrip_model': raw_text, 'ctc_conf': round(ctc_conf, 4),
                   'produk_acuan': acuan['produk'], 'jumlah_acuan': acuan['jumlah']}

        for mode, transkrip in (('model_only', ''), ('hybrid', d['teks'])):
            h = svc.putuskan_transaksi(probs, raw_text, ctc_conf,
                                       transcript=transkrip, jumlah_form=0, mode=mode)
            ditolak = not h.get('success', False)
            top3 = h.get('produk_top3') or []
            pilihan = top3[0][0] if top3 else None
            catatan.update({
                f'{mode}_ditolak': ditolak,
                f'{mode}_produk': pilihan,
                f'{mode}_produk_benar': (not ditolak) and pilihan == acuan['produk'],
                f'{mode}_ambigu': len(top3) > 1,
                f'{mode}_jumlah': h.get('jumlah'),
                f'{mode}_jumlah_source': h.get('jumlah_source'),
                f'{mode}_jumlah_benar': (acuan['jumlah'] is not None
                                         and h.get('jumlah') == acuan['jumlah']),
                f'{mode}_fallback': bool(h.get('usedFallback')),
            })
        baris.append(catatan)

        if i % 50 == 0 or i == len(data):
            print(f'  {i:,}/{len(data):,} ucapan | {time.time()-t0:.0f}s', flush=True)

    if not baris:
        print('Tidak ada ucapan yang berhasil diproses.')
        return

    # ── Ringkasan ────────────────────────────────────────────────
    n = len(baris)
    ada_jumlah = sum(1 for b in baris if b['jumlah_acuan'] is not None)

    def persen(jml, penyebut=n):
        return 100 * jml / max(penyebut, 1)

    print('\n' + '=' * 78)
    print('HASIL — SISTEM DENGAN vs TANPA ASR PIHAK KETIGA')
    print('=' * 78)
    print(f'Ucapan: {n:,} | yang menyebut jumlah: {ada_jumlah:,}\n')

    kolom = ['mode', 'produk_benar_%', 'ditolak_%', 'ambigu_%',
             'jumlah_benar_%', 'transaksi_benar_%', 'pakai_fallback_%']
    print(f'{kolom[0]:12s}' + ''.join(f'{k:>19s}' for k in kolom[1:]))
    ringkas = []
    for mode in ('hybrid', 'model_only'):
        produk_benar = sum(1 for b in baris if b[f'{mode}_produk_benar'])
        ditolak = sum(1 for b in baris if b[f'{mode}_ditolak'])
        ambigu = sum(1 for b in baris if b[f'{mode}_ambigu'])
        jumlah_benar = sum(1 for b in baris if b[f'{mode}_jumlah_benar'])
        transaksi = sum(1 for b in baris
                        if b[f'{mode}_produk_benar'] and b[f'{mode}_jumlah_benar'])
        fallback = sum(1 for b in baris if b[f'{mode}_fallback'])
        nilai = [persen(produk_benar), persen(ditolak), persen(ambigu),
                 persen(jumlah_benar, ada_jumlah), persen(transaksi, ada_jumlah),
                 persen(fallback)]
        print(f'{mode:12s}' + ''.join(f'{v:19.2f}' for v in nilai))
        ringkas.append(dict(zip(kolom, [mode] + [round(v, 2) for v in nilai])))

    beda_produk = ringkas[1]['produk_benar_%'] - ringkas[0]['produk_benar_%']
    beda_jumlah = ringkas[1]['jumlah_benar_%'] - ringkas[0]['jumlah_benar_%']
    beda_transaksi = ringkas[1]['transaksi_benar_%'] - ringkas[0]['transaksi_benar_%']
    print(f'\nSelisih model_only - hybrid (hybrid = batas atas, ASR pihak ketiga sempurna):')
    print(f'  produk    : {beda_produk:+.2f} poin persen')
    print(f'  jumlah    : {beda_jumlah:+.2f} poin persen')
    print(f'  transaksi : {beda_transaksi:+.2f} poin persen')

    # Di mana persisnya kedua mode berbeda
    beda = [b for b in baris
            if (b['model_only_produk'] != b['hybrid_produk']
                or b['model_only_jumlah'] != b['hybrid_jumlah']
                or b['model_only_ditolak'] != b['hybrid_ditolak'])]
    print(f'\nUcapan yang hasilnya BERBEDA antar mode: {len(beda)} ({persen(len(beda)):.2f}%)')
    for b in beda[:8]:
        print(f'  [{b["filename"]}] acuan: produk={b["produk_acuan"]} jumlah={b["jumlah_acuan"]}')
        print(f'     transkrip model : {b["transkrip_model"][:70]}')
        for mode in ('hybrid', 'model_only'):
            print(f'     {mode:11s}: produk={b[f"{mode}_produk"]} '
                  f'jumlah={b[f"{mode}_jumlah"]} ({b[f"{mode}_jumlah_source"]})'
                  f'{" DITOLAK" if b[f"{mode}_ditolak"] else ""}')

    with open(args.out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(baris[0].keys()))
        w.writeheader()
        w.writerows(baris)
    ringkasan_json = os.path.splitext(args.out)[0] + '_ringkasan.json'
    with open(ringkasan_json, 'w', encoding='utf-8') as f:
        json.dump({'n_ucapan': n, 'n_menyebut_jumlah': ada_jumlah,
                   'sumber': args.manifest or args.transcripts,
                   'ringkas': ringkas,
                   'catatan': 'mode hybrid memakai teks acuan sebagai transkrip '
                              'browser, jadi ia batas atas bukan pengukuran '
                              'Web Speech yang sebenarnya'},
                  f, indent=2, ensure_ascii=False)
    print(f'\nTersimpan: {args.out} dan {ringkasan_json}')


if __name__ == '__main__':
    main()

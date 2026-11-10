"""
Verifikasi korpus Tahap 1 sebelum dipakai melatih
=================================================

Korpus yang dibangun otomatis punya satu mode kegagalan yang mahal: label dan
audio tidak sepakat. Kalau forced alignment meleset, klip "produk" bisa berisi
potongan kata harga sementara labelnya nama produk — dan CTC akan dengan patuh
mempelajari kekeliruan itu. Kerusakan seperti ini tidak terlihat dari statistik
durasi mana pun; baru ketahuan setelah berjam-jam GPU terbuang.

Skrip ini memeriksanya dengan memakai model v11 yang ADA SEKARANG sebagai juri:
tiap klip diberi skor terhadap 121 nama produk memakai rescoring CTC Tahap 0,
lalu dicek apakah produk yang menang sama dengan yang ada di label klip itu.

Cara membaca hasilnya — ini penting:

  * Klip BERSIH adalah pemeriksaan label yang sesungguhnya. Model v11 sudah
    terbukti mengenali ucapan sepotong yang bersih dengan baik (95% pada uji
    Tahap 0), jadi kalau angka di kolom ini rendah, yang salah kemungkinan
    besar alignment-nya, bukan modelnya.

  * Klip TERAUGMENTASI memang dirancang supaya sulit bagi model sekarang. Angka
    yang lebih rendah di sini BUKAN kegagalan — justru itu bukti augmentasinya
    menggigit dan ada yang bisa dipelajari. Yang mengkhawatirkan adalah kalau
    angkanya sama tinggi dengan klip bersih: berarti augmentasinya terlalu
    lembut dan korpusnya tidak menambah apa pun.

Menjalankan:
    ../../ai-service/venv/bin/python verify_corpus.py --corpus ../data/processed/tahap1
"""

from __future__ import annotations

import argparse
import collections
import csv
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                '..', '..', 'ai-service'))
from ctc_lexicon import LexiconRescorer, build_padded_infer_fn, logmel, split_context  # noqa: E402
from inference_wrapper_v11 import FinSenseEngineV11, ctc_greedy_decode  # noqa: E402


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def produk_of(transcript: str, produk_vocab: set) -> str | None:
    """Nama produk terpanjang dari vocab yang muncul di label klip."""
    best = None
    for p in produk_vocab:
        if p in transcript and (best is None or len(p) > len(best)):
            best = p
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus', required=True)
    ap.add_argument('--model',
                    default='../../ai-service/model_v11_ctc/finsense_ctc_v11.keras')
    ap.add_argument('--vocab',
                    default='../../ai-service/model_v11_ctc/char_vocab.json')
    ap.add_argument('--prices',
                    default='../../ai-service/model_v10/unit_price_lookup.json')
    ap.add_argument('--limit', type=int, default=0,
                    help='hanya N baris PERTAMA (berurutan, biasanya dari '
                         'sumber yang sama — jarang yang kamu mau)')
    ap.add_argument('--sample', type=int, default=0,
                    help='sampel acak N klip dari seluruh korpus; inilah cara '
                         'yang benar untuk memeriksa korpus besar tanpa '
                         'menunggu puluhan menit')
    ap.add_argument('--seed', type=int, default=0)
    args = ap.parse_args()

    engine = FinSenseEngineV11(args.model, args.vocab, args.prices)
    cfg = engine.audio_config
    infer = build_padded_infer_fn(engine.model, cfg['max_frames'], cfg['n_mels'])
    rescorer = LexiconRescorer(engine.produk_vocab, engine.char2idx, engine.blank_idx)
    infer(np.zeros((1, cfg['max_frames'], cfg['n_mels']), np.float32))
    vocab_set = set(engine.produk_vocab)

    with open(os.path.join(args.corpus, 'manifest.csv'), encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    if args.limit:
        rows = rows[:args.limit]
    if args.sample and args.sample < len(rows):
        import random
        rows = random.Random(args.seed).sample(rows, args.sample)

    import librosa

    hits = collections.defaultdict(list)          # (variant, bersih?) -> [benar?]
    # Dataset ini punya dua gaya penyebutan yang sangat berbeda: berkas bernomor
    # mengikuti template penuh, sedangkan gen_* jauh lebih bebas (kata 'tolong',
    # jumlah tanpa satuan, jumlah di depan produk). Alignment perlu terbukti
    # benar di KEDUANYA, bukan cuma di yang template.
    by_style = collections.defaultdict(list)
    cer_num = collections.defaultdict(int)
    cer_den = collections.defaultdict(int)
    tanpa_produk = 0

    for r in rows:
        gt = produk_of(r['transcript'], vocab_set)
        if gt is None:
            tanpa_produk += 1
            continue
        path = os.path.join(args.corpus, 'wav', r['filename'])
        y, _ = librosa.load(path, sr=cfg['sample_rate'])
        probs = infer(logmel(y, cfg)[None]).numpy()[0]
        raw = ctc_greedy_decode(probs, engine.idx2char, engine.blank_idx)
        prefix, suffix = split_context(raw)
        top = rescorer.rank(probs, prefix, suffix, top_k=1)
        pred = top[0].produk if top else None

        bersih = r['augment'] == 'clean'
        hits[(r['variant'], bersih)].append(pred == gt)
        style = 'gen_* (gaya bebas)' if r['source'].startswith('gen_') else 'bernomor (template)'
        by_style[(style, bersih)].append(pred == gt)
        key = 'bersih' if bersih else 'teraugmentasi'
        cer_num[key] += levenshtein(raw, r['transcript'])
        cer_den[key] += len(r['transcript'])

    print(f'\nklip diperiksa: {sum(len(v) for v in hits.values())}'
          + (f'  (dilewati, label tanpa produk: {tanpa_produk})' if tanpa_produk else ''))

    variants = sorted({v for v, _ in hits})
    print(f"\n{'varian':16s}{'bersih':>22s}{'teraugmentasi':>22s}")
    print('-' * 60)
    for v in variants:
        cells = []
        for bersih in (True, False):
            h = hits[(v, bersih)]
            cells.append(f'{100 * sum(h) / len(h):8.1f}%  (n={len(h):4d})' if h
                         else f'{"-":>8s}          ')
        print(f'{v:16s}{cells[0]:>22s}{cells[1]:>22s}')

    styles = sorted({st for st, _ in by_style})
    if len(styles) > 1:
        print(f"\n{'gaya penyebutan':22s}{'bersih':>22s}{'teraugmentasi':>22s}")
        print('-' * 66)
        for st in styles:
            cells = []
            for bersih in (True, False):
                h = by_style[(st, bersih)]
                cells.append(f'{100 * sum(h) / len(h):8.1f}%  (n={len(h):4d})' if h
                             else f'{"-":>8s}          ')
            print(f'{st:22s}{cells[0]:>22s}{cells[1]:>22s}')

    print()
    for label in ('bersih', 'teraugmentasi'):
        if cer_den[label]:
            print(f'CER transkrip greedy ({label:13s}): '
                  f'{100 * cer_num[label] / cer_den[label]:5.1f}%')

    clean_all = [ok for (v, b), h in hits.items() if b for ok in h]
    aug_all = [ok for (v, b), h in hits.items() if not b for ok in h]
    if clean_all:
        acc_clean = 100 * sum(clean_all) / len(clean_all)
        print(f'\nlabel terverifikasi pada klip bersih: {acc_clean:.1f}%')
        if acc_clean < 85:
            print('  ^ RENDAH — periksa forced alignment sebelum melatih.')
    if clean_all and aug_all:
        acc_aug = 100 * sum(aug_all) / len(aug_all)
        print(f'akurasi model sekarang pada klip teraugmentasi: {acc_aug:.1f}%'
              f'  (selisih {acc_clean - acc_aug:+.1f} poin)')
        if acc_clean - acc_aug < 5:
            print('  ^ selisihnya tipis: augmentasinya mungkin terlalu lembut.')


if __name__ == '__main__':
    main()

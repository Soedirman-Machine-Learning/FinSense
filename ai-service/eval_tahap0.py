"""
Eval Tahap 0 — membandingkan jalur inferensi lama vs baru, dan mengkalibrasi ambang.
====================================================================================

Membandingkan lima kombinasi di tiga kondisi ucapan:

  A  pad + greedy + fuzzy       jalur lama (sebelum Tahap 0)
  B  variabel + fuzzy           efek membuang padding saja
  C  variabel + rescoring CTC   membuang padding + decoder baru
  D  pad + rescoring CTC bare   decoder baru tanpa konteks prefix/suffix
  E  pad + rescoring CTC ctx    JALUR BARU yang dipakai serve_model.py

Kondisi:
  FULL      "jual <produk> dua bungkus seribu rupiah"   (bentuk data latih)
  FRAG      "<produk>"                                  (yang ingin didukung)
  FRAG+SIL  2.5 dtk hening + "<produk>" + 2.5 dtk hening
  NEG       ucapan yang bukan produk mana pun           (harus ditolak)

Himpunan uji dibangkitkan dengan TTS bawaan macOS (`say`) memakai suara
Damayanti (id_ID) dan Amira (ms_MY). Keduanya BUKAN suara yang dipakai saat
melatih model, jadi ini uji out-of-domain — angka absolutnya lebih rendah
daripada data latih, tapi perbandingan antar metode tetap sah dan justru
lebih mendekati kondisi nyata.

Jalankan (pakai Python milik venv — soundfile/tensorflow hanya terpasang di sana;
`python` biasa akan gagal dengan ModuleNotFoundError):

    ./venv/bin/python eval_tahap0.py --generate   # sekali, untuk membuat klip uji
    ./venv/bin/python eval_tahap0.py              # evaluasi model v11 (bawaan)

    # setelah melatih model baru — kalibrasi ulang ambangnya:
    ./venv/bin/python eval_tahap0.py \\
        --model model_v12/finsense_ctc_v12.keras \\
        --vocab model_v12/char_vocab.json
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import random
import subprocess
import sys
import time

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '3')

import numpy as np
import soundfile as sf

from ctc_lexicon import (
    LexiconRescorer,
    build_padded_infer_fn,
    build_variable_length_model,
    logmel,
    split_context,
)
from inference_wrapper_v11 import (
    FinSenseEngineV11,
    ctc_greedy_decode,
    fuzzy_match_produk,
)

HERE = os.path.dirname(os.path.abspath(__file__))
EVAL_DIR = os.path.join(HERE, 'eval_data')
MANIFEST = os.path.join(EVAL_DIR, 'manifest.json')

CONDS = ['FULL', 'FRAG', 'FRAG+SIL']
NEG_TEXTS = [
    'selamat pagi bu bagaimana kabarnya',
    'tolong ambilkan air minum di belakang',
    'besok saya tidak jualan ya',
    'harga bensin naik lagi bulan ini',
    'anak saya sekolah di jakarta selatan',
    'kucing itu tidur di atas meja',
    'nanti sore saya pergi ke pasar',
    'hujan deras sekali hari ini',
    'nomor teleponnya berapa ya',
    'sudah makan siang belum kamu',
]


# ─────────────────────────────────────────────────────────────────────
def generate(produk_vocab, n_produk=40, seed=7):
    """Bangkitkan klip uji dengan `say` (macOS)."""
    os.makedirs(EVAL_DIR, exist_ok=True)
    rng = random.Random(seed)
    sel = rng.sample(list(produk_vocab), n_produk)
    qty = {1: 'satu', 2: 'dua', 3: 'tiga'}
    man = []

    def say(text, voice, out):
        subprocess.run(
            ['say', '-v', voice, '-o', out, '--file-format=WAVE',
             '--data-format=LEI16@16000', text], check=True)

    for i, p in enumerate(sel):
        voice = 'Damayanti' if i % 2 == 0 else 'Amira'
        q = rng.choice([1, 2, 3])
        for cond, text in [('FULL', f'jual {p} {qty[q]} bungkus seribu rupiah'),
                           ('FRAG', p)]:
            wav = os.path.join(EVAL_DIR, f'{i:03d}_{cond.replace("+", "")}.wav')
            say(text, voice, wav)
            man.append({'file': wav, 'cond': cond, 'gt': p, 'voice': voice})
            if cond == 'FRAG':
                d, sr = sf.read(wav)
                sil = np.zeros(int(2.5 * sr), np.float32)
                w2 = os.path.join(EVAL_DIR, f'{i:03d}_FRAGSIL.wav')
                sf.write(w2, np.concatenate([sil, d.astype(np.float32), sil]), sr)
                man.append({'file': w2, 'cond': 'FRAG+SIL', 'gt': p, 'voice': voice})

    for i, t in enumerate(NEG_TEXTS):
        voice = 'Damayanti' if i % 2 == 0 else 'Amira'
        wav = os.path.join(EVAL_DIR, f'neg_{i:02d}.wav')
        say(t, voice, wav)
        man.append({'file': wav, 'cond': 'NEG', 'gt': None, 'voice': voice})

    json.dump(man, open(MANIFEST, 'w'), indent=1)
    print(f'{len(man)} klip -> {EVAL_DIR}')


# ─────────────────────────────────────────────────────────────────────
def load_audio(path, cfg):
    import librosa
    d, sr = sf.read(path)
    if d.ndim > 1:
        d = d.mean(axis=1)
    d = d.astype(np.float32)
    if sr != cfg['sample_rate']:
        d = librosa.resample(y=d, orig_sr=sr, target_sr=cfg['sample_rate'])
    trimmed, _ = librosa.effects.trim(d, top_db=40)
    if trimmed.size >= int(0.2 * cfg['sample_rate']):
        d = trimmed
    return d


def pad_to(feat, n_frames, n_mels):
    T = feat.shape[0]
    if T < n_frames:
        return np.vstack([feat, np.zeros((n_frames - T, n_mels), np.float32)])
    return feat[:n_frames]



METHODS = ['A pad+fuzzy (lama)', 'B var+fuzzy', 'C var+ctc',
           'D pad+ctc bare', 'E pad+ctc ctx (baru)']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--generate', action='store_true',
                    help='bangkitkan klip uji dengan TTS macOS (sekali saja)')
    # Model dibuat bisa ditunjuk karena inilah gunanya skrip ini: setiap kali
    # model baru dilatih, ambang keputusannya WAJIB dikalibrasi ulang terhadap
    # model itu. Ambang lama melekat pada sebaran keyakinan model lama.
    ap.add_argument('--model', default='model_v11_ctc/finsense_ctc_v11.keras',
                    help='berkas .keras yang dievaluasi')
    ap.add_argument('--vocab', default='model_v11_ctc/char_vocab.json',
                    help='char_vocab.json milik model tersebut')
    ap.add_argument('--prices', default='model_v10/unit_price_lookup.json',
                    help='sumber 121 nama produk untuk rescoring leksikon')
    args = ap.parse_args()

    print(f'model dievaluasi: {args.model}')
    engine = FinSenseEngineV11(args.model, args.vocab, args.prices)

    if args.generate:
        generate(engine.produk_vocab)
        return
    if not os.path.exists(MANIFEST):
        sys.exit('himpunan uji belum ada — jalankan: '
                 './venv/bin/python eval_tahap0.py --generate')

    cfg = engine.audio_config
    infer = build_padded_infer_fn(engine.model, cfg['max_frames'], cfg['n_mels'])
    var_model = build_variable_length_model(engine.model)
    rescorer = LexiconRescorer(engine.produk_vocab, engine.char2idx, engine.blank_idx)
    infer(np.zeros((1, cfg['max_frames'], cfg['n_mels']), np.float32))  # warm-up

    man = json.load(open(MANIFEST))
    hits = collections.defaultdict(lambda: collections.defaultdict(list))
    lat = collections.defaultdict(list)
    # untuk kalibrasi penolakan: skor top-1 pada ucapan produk vs bukan produk
    rej = {'pos': {'fuzzy': [], 'nll_pc': []}, 'neg': {'fuzzy': [], 'nll_pc': []}}
    margins = {'ok': [], 'bad': []}
    decisions = []  # (gt, top-k) untuk simulasi keputusan produksi

    for m in man:
        y = load_audio(m['file'], cfg)
        gt, cond = m['gt'], m['cond']
        feat_var = logmel(y, cfg, pad=False)
        feat_pad = pad_to(feat_var, cfg['max_frames'], cfg['n_mels'])

        t0 = time.perf_counter()
        probs_pad = infer(feat_pad[None]).numpy()[0]
        lat['akustik pad (tf.function)'].append(time.perf_counter() - t0)

        t0 = time.perf_counter()
        engine.model({'log_mel': feat_pad[None]}, training=False)
        lat['akustik pad (eager, lama)'].append(time.perf_counter() - t0)

        probs_var = var_model(feat_var[None], training=False).numpy()[0]

        raw_pad = ctc_greedy_decode(probs_pad, engine.idx2char, engine.blank_idx)
        raw_var = ctc_greedy_decode(probs_var, engine.idx2char, engine.blank_idx)
        fz_pad, fz_score = fuzzy_match_produk(raw_pad, engine.produk_vocab)
        fz_var, _ = fuzzy_match_produk(raw_var, engine.produk_vocab)

        pre_p, suf_p = split_context(raw_pad)
        pre_v, suf_v = split_context(raw_var)
        t0 = time.perf_counter()
        top_e = rescorer.rank(probs_pad, pre_p, suf_p, top_k=TOP_K_EVAL)
        lat['rescoring leksikon'].append(time.perf_counter() - t0)
        top_c = rescorer.rank(probs_var, pre_v, suf_v, top_k=TOP_K_EVAL)
        top_d = rescorer.rank(probs_pad, top_k=TOP_K_EVAL)

        best_e = top_e[0] if top_e else None

        if cond == 'NEG':
            rej['neg']['fuzzy'].append(fz_score)
            if best_e:
                rej['neg']['nll_pc'].append(best_e.nll_per_char)
            continue

        rej['pos']['fuzzy'].append(fz_score)
        if best_e:
            rej['pos']['nll_pc'].append(best_e.nll_per_char)

        preds = [fz_pad, fz_var,
                 top_c[0].produk if top_c else None,
                 top_d[0].produk if top_d else None,
                 best_e.produk if best_e else None]
        for name, pred in zip(METHODS, preds):
            hits[name][cond].append(pred == gt)
        if best_e and len(top_e) > 1:
            margins['ok' if best_e.produk == gt else 'bad'].append(
                top_e[1].nll - best_e.nll)
        if best_e and best_e.nll_per_char <= 6.4:
            decisions.append((gt, top_e))

    # ── tabel akurasi ──
    print(f"\n{'metode':24s}" + ''.join(f'{c:>11s}' for c in CONDS) + f"{'SEMUA':>11s}")
    print('-' * 68)
    for name in METHODS:
        cells, allv = [], []
        for c in CONDS:
            v = hits[name][c]
            cells.append(f'{100 * sum(v) / len(v):9.1f}%')
            allv += v
        print(f'{name:24s}' + ''.join(cells) + f'{100 * sum(allv) / len(allv):9.1f}%')

    print('\nlatensi rata-rata per ucapan (ms):')
    for k, v in lat.items():
        print(f'  {k:28s} {1000 * np.mean(v):8.1f}')

    # ── penolakan: seberapa bersih ucapan bukan-produk bisa dibedakan ──
    print('\npenolakan ucapan di luar daftar produk '
          f'(n_produk={len(rej["pos"]["fuzzy"])}, n_bukan={len(rej["neg"]["fuzzy"])}):')
    for label, key, reject_if_below in [
            ('skor fuzzy (lama)', 'fuzzy', True),
            ('nll_per_char (baru)', 'nll_pc', False)]:
        pos, neg = np.array(rej['pos'][key]), np.array(rej['neg'][key])
        # ambang terbaik = yang memaksimalkan (benar ditolak + benar diterima)
        cands = np.unique(np.concatenate([pos, neg]))
        best = max(
            cands,
            key=lambda t: ((pos >= t).mean() + (neg < t).mean()) if reject_if_below
            else ((pos <= t).mean() + (neg > t).mean()))
        if reject_if_below:
            tpr, far = (pos >= best).mean(), (neg >= best).mean()
        else:
            tpr, far = (pos <= best).mean(), (neg <= best).mean()
        print(f'  {label:22s} ambang={best:6.2f}  produk lolos={100 * tpr:5.1f}%  '
              f'bukan-produk lolos (salah terima)={100 * far:5.1f}%')

    # ── kualitas keputusan seperti di produksi ──
    # Yang menentukan pengalaman kasir bukan akurasi top-1, tapi seberapa sering
    # sistem (a) langsung benar, (b) bertanya, (c) salah tanpa bertanya.
    print('\nsimulasi keputusan produksi (ambang serve_model.py):')
    print(f"  {'conf':>6s} {'langsung benar':>15s} {'SALAH diterima':>15s} "
          f"{'tanya (gt di top3)':>19s} {'tanya (gt tidak ada)':>21s}")
    for thr in [0.80, 0.90, 0.95, 0.99]:
        auto_ok = auto_bad = ask_ok = ask_bad = 0
        for gt, top in decisions:
            if top[0].prob >= thr:
                auto_ok += top[0].produk == gt
                auto_bad += top[0].produk != gt
            else:
                hit = any(c.produk == gt for c in top)
                ask_ok += hit
                ask_bad += not hit
        n = len(decisions)
        print(f'  {thr:6.2f} {100 * auto_ok / n:14.1f}% {100 * auto_bad / n:14.1f}% '
              f'{100 * ask_ok / n:18.1f}% {100 * ask_bad / n:20.1f}%')

    # ── kalibrasi temperatur posterior ──
    print('\nkalibrasi TEMPERATURE — selisih nll top-1 vs top-2 (nat):')
    ok, bad = margins['ok'], margins['bad']
    print(f'  benar (n={len(ok):3d})  p10={np.percentile(ok, 10):6.1f} '
          f'p50={np.percentile(ok, 50):6.1f}')
    if bad:
        print(f'  salah (n={len(bad):3d})  p50={np.percentile(bad, 50):6.1f} '
              f'p90={np.percentile(bad, 90):6.1f}')
    tau = rescorer.TEMPERATURE
    print(f'  TEMPERATURE={tau}: posterior top-1 pada selisih p10-benar = '
          f'{1 / (1 + np.exp(-np.percentile(ok, 10) / tau)):.3f}; '
          f'pada selisih p50-salah = '
          f'{1 / (1 + np.exp(-np.percentile(bad, 50) / tau)):.3f}' if bad else '')


TOP_K_EVAL = 3

if __name__ == '__main__':
    main()

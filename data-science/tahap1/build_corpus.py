"""
Membangun korpus latih Tahap 1 dari rekaman yang sudah ada
===========================================================

Dataset FinSense berisi 5100 rekaman manusia (6.3 jam). Penyebutannya sudah
cukup beragam — ada empat kata intent (jual/tolong/keluar/laku/beli), jumlah
yang kadang bersatuan kadang tidak, bahkan jumlah yang disebut di depan nama
produk. Tapi sebagian besar tetap menyebut produk di TENGAH kalimat, sehingga
model kurang terlatih pada ucapan yang berhenti di nama produk saja.

Solusinya di sini BUKAN merekam ulang, melainkan memanen ulang rekaman yang
sudah ada. Dengan forced alignment (ctc_align.py) kita tahu frame ke berapa tiap
kata diucapkan, jadi satu rekaman bisa dipotong menjadi beberapa klip latih yang
semuanya audio manusia asli dengan label yang pasti benar:

    full           "jual abc kecap asin ... dua bungkus ... rupiah"
    produk         "abc kecap asin enam ratus dua puluh mililiter"
    intent_produk  "jual abc kecap asin enam ratus dua puluh mililiter"
    produk_qty     "abc kecap asin enam ratus dua puluh mililiter dua bungkus"

Semua varian adalah rentang kata yang BERSAMBUNG di dalam rekaman aslinya, jadi
tidak ada penyambungan audio yang menghasilkan potongan tak wajar.

Peran tiap kata ditemukan dengan berpatokan pada kosakata produk (lihat
Segmenter), bukan pada pola kalimat — lihat docstring kelas itu untuk alasannya.

Tiap klip lalu lewat rantai augmentasi acak (augment.py) supaya korpusnya
menutup kondisi produksi: jeda sebelum bicara, derau warung, ruangan bergema,
level mikrofon berbeda, dan kompresi Opus dari browser.

CATATAN — 8% rekaman (410 dari 5100) lebih panjang dari jendela 8 detik model.
Untuk klip itu rentang KATA-nya yang dipangkas dari belakang, bukan audionya,
supaya label dan audio tetap sepakat. Kalau jendela model diperbesar di Tahap 2,
pemangkasan ini otomatis berkurang.

Menjalankan:
    cd data-science/tahap1
    ../../ai-service/venv/bin/python build_corpus.py \\
        --audio-dir <dir wav> --transcripts <csv> --out <dir keluaran>

Keluaran: <out>/wav/*.wav + manifest.csv, manifest_train.csv, manifest_val.csv
(kolom: filename, transcript, variant, source, augment, duration).
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys

import numpy as np

from ctc_align import Aligner

# Kata jumlah/satuan diambil dari sumber yang sama dengan yang dipakai layanan
# inferensi, supaya definisinya tidak pernah bercabang.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                '..', '..', 'ai-service'))
from inference_wrapper_v10 import _QTY, _QTY_UNITS_STRONG  # noqa: E402

import augment as A  # noqa: E402

# 'tolong' muncul 855 kali di dataset dan tidak ada di daftar awal saya —
# tanpa ini ia ikut terbawa sebagai bagian nama produk.
INTENT_WORDS = {'jual', 'beli', 'tambah', 'jualan', 'laku', 'keluar', 'pesan',
                'tolong'}

# Varian yang dihasilkan per rekaman sumber. Komposisi akhirnya:
#   produk saja 40%, kalimat penuh 20%, intent+produk 20%, produk+qty 20%.
# "produk" muncul dua kali karena ucapan sepotong itulah yang paling kurang
# terwakili di data asli — dan augmentasinya diacak, jadi kedua salinan itu
# tidak identik.
VARIANT_PLAN = ['full', 'produk', 'produk', 'intent_produk', 'produk_qty']

# Sebagian klip sengaja dibiarkan (nyaris) bersih supaya model tetap punya
# acuan sinyal tanpa gangguan.
CLEAN_FRACTION = 0.20

# Dataset finsense_expanded ternyata SUDAH memuat salinan teraugmentasi: dari
# 5100 berkas, 2600 di antaranya adalah versi pitch-shift / noise / speed dari
# 1300 rekaman dasar, ditandai lewat akhiran nama berkas.
#
#     gen_00286.wav  gen_00286_p+2.wav  gen_00286_nz20.wav   <- satu ucapan sama
#
# Ini penting untuk dua hal. Pertama, split train/val harus mengelompokkan
# mereka; kalau tidak, ucapan yang sama muncul di kedua sisi dan angka validasi
# jadi bohong. Kedua, menumpuk augmentasi kita di atas augmentasi mereka
# menghasilkan kombinasi yang tak terkendali (speed 1.1 di atas sp11 = 1.21x)
# dan membuat klip "bersih" tidak lagi benar-benar bersih — padahal kolom itulah
# yang dipakai verify_corpus.py untuk memeriksa label.
AUG_SUFFIX = re.compile(r'_(p[+-]\d+|nz\d+|sp\d+)$')


def base_id(filename: str) -> str:
    """Nama rekaman dasar, dengan akhiran augmentasi bawaan dataset dibuang."""
    return AUG_SUFFIX.sub('', os.path.splitext(filename)[0])

# Jendela masukan model. Klip yang lebih panjang dari ini akan terpotong saat
# training dan labelnya jadi tidak cocok dengan audionya, jadi anggaran
# keheningan dihitung agar hasil akhirnya muat.
MAX_SECONDS = 8.0


class Roles(dict):
    """Peta peran -> (indeks kata awal, indeks kata akhir) inklusif."""


class Segmenter:
    """Menemukan peran kata dengan berpatokan pada KOSAKATA PRODUK, bukan template.

    Versi pertama modul ini mengurai kalimat dengan pola tetap
    "<intent> <produk> <qty> <satuan> <harga>". Pada dataset yang sebenarnya
    pola itu hanya menutup 55% baris. Ucapan nyatanya jauh lebih beragam:

        "jual aqua enam ratus mililiter dua bungkus tiga puluh enam ribu rupiah"
        "tolong abc kecap asin enam ratus dua puluh mililiter"    (tanpa qty)
        "keluar gaga seratus habanero enam"                       (qty tanpa satuan)
        "empat glad two glow moisturizer"                         (qty di DEPAN)

    Karena daftar produknya tertutup (121 nama), jauh lebih andal mencari
    rentang kata terpanjang yang persis sama dengan salah satu nama produk,
    lalu menafsirkan sisanya di kiri dan kanan. Cara ini menemukan produk pada
    5100 dari 5100 transkrip, dibanding 2799 dengan pencocokan template.
    """

    def __init__(self, produk_vocab):
        self._index = {}
        for p in produk_vocab:
            self._index.setdefault(len(p.split()), {})[tuple(p.split())] = p
        self._lengths = sorted(self._index, reverse=True)

    def find_produk(self, words: list[str]):
        """Rentang (awal, akhir inklusif) nama produk terpanjang, atau None."""
        for L in self._lengths:                     # nama terpanjang menang
            table = self._index[L]
            for i in range(len(words) - L + 1):
                if tuple(words[i:i + L]) in table:
                    return i, i + L - 1
        return None

    def parse(self, words: list[str]) -> Roles | None:
        span = self.find_produk(words)
        if span is None:
            return None
        pi, pj = span

        roles = Roles()
        roles['produk'] = span

        # Kiri: kata intent, dan/atau penyebutan jumlah yang mendahului produk.
        for i in range(pi):
            if words[i] in INTENT_WORDS:
                roles['intent'] = (i, i)
            elif words[i] in _QTY:
                roles['qty'] = (i, i)

        # Kanan: jumlah pertama (beserta satuannya kalau ada), sisanya harga.
        for i in range(pj + 1, len(words)):
            if words[i] in _QTY:
                end = i
                if i + 1 < len(words) and words[i + 1] in _QTY_UNITS_STRONG:
                    end = i + 1
                roles['qty'] = (i, end)
                if end + 1 < len(words):
                    roles['harga'] = (end + 1, len(words) - 1)
                break
        return roles


VARIANT_ROLES = {
    'full': None,  # seluruh ucapan
    'produk': ['produk'],
    'intent_produk': ['intent', 'produk'],
    'produk_qty': ['produk', 'qty'],
}


def variant_word_range(variant: str, roles: Roles, n_words: int):
    """-> (awal, akhir inklusif, nama varian sebenarnya), atau None.

    Tidak semua ucapan punya semua peran: 744 transkrip berhenti tepat setelah
    nama produk (tidak ada qty), dan sebagian tidak berkata intent sama sekali.
    Kalau peran yang diminta tidak ada, klipnya tetap dibuat tapi DILABELI ULANG
    sebagai 'produk', supaya statistik komposisi di manifest tidak berbohong
    tentang apa yang sebenarnya ada di dalamnya.
    """
    if variant == 'full':
        return 0, n_words - 1, 'full'
    needed = VARIANT_ROLES[variant]
    present = [r for r in needed if r in roles]
    if 'produk' not in present:
        return None
    start = min(roles[r][0] for r in present)
    end = max(roles[r][1] for r in present)
    effective = variant if len(present) == len(needed) else 'produk'
    # Rentang yang persis sama dengan seluruh ucapan bukan lagi potongan.
    if (start, end) == (0, n_words - 1) and variant != 'full':
        effective = 'full'
    return start, end, effective


def build(args):
    import json
    with open(args.prices, encoding='utf-8') as f:
        produk_vocab = json.load(f)['produk_vocab']
    segmenter = Segmenter(produk_vocab)
    aligner = Aligner(args.model, args.vocab)
    sr = aligner.cfg['sample_rate']
    rng = np.random.default_rng(args.seed)

    with open(args.transcripts, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    if args.dedup_augmented:
        # Simpan satu wakil per rekaman dasar, utamakan yang tanpa akhiran.
        best = {}
        for r in rows:
            b = base_id(r['filename'])
            cur = best.get(b)
            if cur is None or len(r['filename']) < len(cur['filename']):
                best[b] = r
        n_before = len(rows)
        rows = [best[b] for b in sorted(best)]
        if n_before != len(rows):
            print(f'salinan teraugmentasi bawaan dataset dilewati: '
                  f'{n_before} berkas -> {len(rows)} rekaman unik')

    if args.limit:
        rows = rows[:args.limit]

    out_wav = os.path.join(args.out, 'wav')
    os.makedirs(out_wav, exist_ok=True)

    import librosa
    import soundfile as sf

    manifest = []
    stats = {'ok': 0, 'tanpa_audio': 0, 'audio_tak_terbaca': 0,
             'produk_tak_dikenali': 0, 'alignment_gagal': 0,
             'melebihi_jendela': 0, 'ekor_dipangkas': 0}

    for row in rows:
        name = row['filename']
        transcript = ' '.join(str(row['transcript']).lower().split())
        path = os.path.join(args.audio_dir, name)
        if not os.path.exists(path):
            stats['tanpa_audio'] += 1
            continue

        words = transcript.split()
        roles = segmenter.parse(words)
        if roles is None:
            stats['produk_tak_dikenali'] += 1
            continue

        try:
            y, _ = librosa.load(path, sr=sr)
        except Exception as e:
            # Berkas tidak terbaca. Di dataset ini penyebab tersering bukan
            # berkasnya rusak, melainkan berkasnya masih berupa placeholder
            # iCloud yang gagal diunduh saat dibaca.
            stats['audio_tak_terbaca'] += 1
            if stats['audio_tak_terbaca'] <= 3:
                print(f'  tidak terbaca: {name} ({type(e).__name__})')
            continue
        if y.size < int(0.3 * sr):
            # Berkas kosong atau terpotong (mis. perekaman gagal di tengah).
            stats['alignment_gagal'] += 1
            continue
        try:
            spans = aligner.align(y, transcript)
        except ValueError:
            stats['alignment_gagal'] += 1
            continue
        if len(spans) != len(words):
            # Alignment tidak memulangkan semua kata (mis. rekaman terpotong):
            # lebih baik dilewati daripada memotong di tempat yang salah.
            stats['alignment_gagal'] += 1
            continue

        stem = os.path.splitext(name)[0]
        for k, variant in enumerate(VARIANT_PLAN):
            rng_clip = np.random.default_rng(
                abs(hash((stem, variant, k))) % (2 ** 32) + args.seed)

            rng_ = variant_word_range(variant, roles, len(words))
            if rng_ is None:
                continue
            rmin, rmax, variant = rng_

            # Sebagian rekaman sumber lebih panjang dari jendela 8 detik model.
            # Kalau audionya saja yang dipotong, labelnya jadi menjanjikan kata
            # yang tidak ada di audio — persis jenis kerusakan yang paling
            # merusak latihan CTC. Jadi yang dipangkas rentang KATA-nya, dari
            # belakang (harga dulu, lalu qty), sehingga label dan audio tetap
            # sepakat.
            trimmed_tail = False
            while rmax > rmin:
                lo, hi = aligner.frames_to_samples(
                    spans[rmin].start_frame, spans[rmax].end_frame, len(y))
                if (hi - lo) / sr <= MAX_SECONDS:
                    break
                rmax -= 1
                trimmed_tail = True

            core_text = ' '.join(words[rmin:rmax + 1])
            lo, hi = aligner.frames_to_samples(
                spans[rmin].start_frame, spans[rmax].end_frame, len(y))
            core = y[lo:hi]
            if core.size < int(0.2 * sr) or core.size / sr > MAX_SECONDS:
                stats['melebihi_jendela'] += core.size / sr > MAX_SECONDS
                continue
            if trimmed_tail:
                stats['ekor_dipangkas'] += 1

            # Anggaran keheningan supaya hasil akhirnya tetap muat di jendela.
            budget = MAX_SECONDS - core.size / sr
            if rng_clip.random() < CLEAN_FRACTION or budget <= 0.1:
                clip, used = core, []
            else:
                # Batasi keheningan pada anggaran yang tersisa, dan sisakan
                # ruang untuk speed_perturb yang bisa memanjangkan sampai ~11%.
                room = max(0.0, budget - core.size / sr * 0.11)
                clip, used = A.random_chain(
                    core, rng_clip, sr,
                    lead_range=(0.0, min(3.0, room * 0.7)),
                    tail_range=(0.0, min(1.5, room * 0.3)))
                if clip.size / sr > MAX_SECONDS:
                    # Masih lewat (speed memperlambat): buang ekor keheningan.
                    clip = clip[:int(MAX_SECONDS * sr)]

            dur = clip.size / sr

            out_name = f'{stem}_{variant}_{k}.{args.format}'
            sf.write(os.path.join(out_wav, out_name), clip, sr)
            manifest.append({
                'filename': out_name,
                'transcript': core_text,
                'variant': variant,
                'source': name,
                'augment': '+'.join(used) if used else 'clean',
                'duration': round(dur, 3),
            })
        stats['ok'] += 1

    fields = ['filename', 'transcript', 'variant', 'source', 'augment', 'duration']

    def write_csv(path, rows_):
        with open(path, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows_)

    man_path = os.path.join(args.out, 'manifest.csv')
    write_csv(man_path, manifest)

    # Pemisahan train/val HARUS berdasarkan rekaman sumber, bukan per klip.
    # Lima klip yang berasal dari satu rekaman adalah potongan dan augmentasi
    # dari audio yang sama; kalau sebagian masuk train dan sebagian masuk val,
    # angka validasinya bocor dan terlihat jauh lebih bagus dari kenyataan.
    if args.val_fraction > 0 and manifest:
        # Dikelompokkan per REKAMAN DASAR: lima klip dari satu rekaman, dan
        # juga salinan p+2/nz20/sp11 dari ucapan yang sama, harus jatuh di sisi
        # yang sama.
        sources = sorted({base_id(m['source']) for m in manifest})
        sources = [sources[i] for i in rng.permutation(len(sources))]
        n_val = max(1, int(len(sources) * args.val_fraction))
        val_src = set(sources[:n_val])
        train = [m for m in manifest if base_id(m['source']) not in val_src]
        val = [m for m in manifest if base_id(m['source']) in val_src]
        write_csv(os.path.join(args.out, 'manifest_train.csv'), train)
        write_csv(os.path.join(args.out, 'manifest_val.csv'), val)
        print(f'\nsplit per rekaman sumber: {len(sources) - n_val} train / '
              f'{n_val} val  ->  {len(train)} / {len(val)} klip')

        # Tugas ini kosakata tertutup: produk yang hanya muncul di val tidak
        # akan pernah dilatih, dan akurasinya otomatis nol. Lebih baik
        # ketahuan sekarang daripada setelah training.
        def produk_set(rows_):
            return {m['transcript'] for m in rows_ if m['variant'] == 'produk'}
        only_val = produk_set(val) - produk_set(train)
        if only_val:
            print(f'  PERINGATAN: {len(only_val)} produk hanya ada di val, '
                  f'tidak pernah dilatih. Perbesar korpus atau kecilkan '
                  f'--val-fraction. Contoh: {sorted(only_val)[:3]}')

    print(f'\nrekaman sumber diproses : {stats["ok"]}')
    for k in ('tanpa_audio', 'audio_tak_terbaca', 'produk_tak_dikenali',
              'alignment_gagal', 'melebihi_jendela'):
        if stats[k]:
            print(f'  dilewati/{k:22s}: {stats[k]}')
    if stats['ekor_dipangkas']:
        print(f'  klip yang ekor katanya dipangkas agar muat jendela: '
              f'{stats["ekor_dipangkas"]}')
    print(f'klip dihasilkan          : {len(manifest)}')
    if manifest:
        import collections
        comp = collections.Counter(m['variant'] for m in manifest)
        n = len(manifest)
        print('komposisi varian:')
        for v, c in comp.most_common():
            print(f'  {v:16s} {c:6d}  ({100 * c / n:4.1f}%)')
        durs = np.array([m['duration'] for m in manifest])
        print(f'durasi: min {durs.min():.2f}s  median {np.median(durs):.2f}s  '
              f'maks {durs.max():.2f}s  total {durs.sum() / 3600:.2f} jam')
        n_clean = sum(1 for m in manifest if m['augment'] == 'clean')
        print(f'klip bersih (tanpa augmentasi): {n_clean} ({100 * n_clean / n:.1f}%)')
    total_mb = sum(os.path.getsize(os.path.join(out_wav, m['filename']))
                   for m in manifest) / 1e6
    print(f'ukuran di disk: {total_mb:.0f} MB ({args.format})')
    print(f'\nmanifest -> {man_path}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio-dir', required=True)
    ap.add_argument('--transcripts', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--model',
                    default='../../ai-service/model_v11_ctc/finsense_ctc_v11.keras')
    ap.add_argument('--vocab',
                    default='../../ai-service/model_v11_ctc/char_vocab.json')
    ap.add_argument('--prices',
                    default='../../ai-service/model_v10/unit_price_lookup.json',
                    help='sumber daftar 121 nama produk untuk penjangkaran')
    ap.add_argument('--format', choices=['flac', 'wav'], default='flac',
                    help='flac itu lossless dan kira-kira separuh ukuran wav; '
                         'librosa/soundfile membaca keduanya sama saja')
    ap.add_argument('--dedup-augmented', action='store_true', default=True,
                    help='lewati salinan pitch/noise/speed bawaan dataset, '
                         'pakai rekaman dasarnya saja (default)')
    ap.add_argument('--no-dedup-augmented', dest='dedup_augmented',
                    action='store_false')
    ap.add_argument('--seed', type=int, default=1337)
    ap.add_argument('--limit', type=int, default=0,
                    help='proses hanya N baris pertama (untuk uji cepat)')
    ap.add_argument('--val-fraction', type=float, default=0.1,
                    help='porsi rekaman SUMBER yang disisihkan untuk validasi')
    build(ap.parse_args())


if __name__ == '__main__':
    main()

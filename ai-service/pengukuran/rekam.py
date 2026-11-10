"""
Perekam sesi pengukuran jarak dan derau (RM3)
=============================================

Merekam ucapan nama produk untuk mengisi Tabel 4.18, 4.19, dan 4.20 pada naskah.
Satu pemanggilan = satu kondisi (satu jarak, satu kondisi derau). Skrip memandu
ucapan satu per satu, merekam lewat ffmpeg, memeriksa mutu rekaman seketika
(keheningan awal, ada tidaknya ucapan, puncak sinyal, SNR kasar), lalu menulis
berkas dan satu baris manifest untuk setiap ucapan.

Daftar produk yang diucapkan selalu sama untuk semua kondisi (dipilih sekali
dengan benih tetap), sebab perbandingan antarkondisi hanya sah bila ucapannya
sama persis.

Menjalankan (dari folder ai-service):
    ./venv/bin/python pengukuran/rekam.py --daftar-perangkat
    ./venv/bin/python pengukuran/rekam.py --jarak 10 --derau sunyi --perangkat 0

Berkas keluaran:
    <out>/10cm_sunyi/01_sedaap-goreng.wav ...
    <out>/manifest.csv    (filename,jarak_cm,derau,produk,teks)
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KATALOG = os.path.join(AI, 'model_v10', 'unit_price_lookup.json')
DERAU = ('sunyi', 'kipas', 'kendaraan')
JARAK = (10, 20, 30, 40)
HENING_AWAL_DETIK = 1.2          # dipakai sebagai contoh derau saat menghitung SNR


# ── daftar ucapan ────────────────────────────────────────────────────
def daftar_produk(jumlah: int = 12, benih: int = 42) -> list[str]:
    """Produk terpilih, merata menurut panjang nama, dengan urutan tetap."""
    vocab = json.load(open(KATALOG, encoding='utf-8'))['produk_vocab']

    def kelompok(p: str) -> str:
        n = len(p.split())
        return 'pendek' if n <= 2 else 'sedang' if n == 3 else 'panjang' if n == 4 else 'sangat panjang'

    rng = random.Random(benih)
    pilih: list[str] = []
    for k in ('pendek', 'sedang', 'panjang', 'sangat panjang'):
        anggota = sorted(p for p in vocab if kelompok(p) == k)
        pilih += rng.sample(anggota, max(1, jumlah // 4))
    return pilih[:jumlah]


def slug(teks: str) -> str:
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', teks.lower())).strip('-')


# ── perekaman ────────────────────────────────────────────────────────
def daftar_perangkat() -> None:
    p = subprocess.run(['ffmpeg', '-hide_banner', '-f', 'avfoundation',
                        '-list_devices', 'true', '-i', ''],
                       capture_output=True, text=True)
    teks = p.stderr
    audio = teks.split('AVFoundation audio devices:')[-1] if 'audio devices' in teks else teks
    print('Perangkat audio yang terbaca ffmpeg:\n')
    for baris in audio.splitlines():
        if '] [' in baris:
            print('   ', baris.split('] ', 1)[-1])
    print('\nPakai angka di dalam kurung siku sebagai --perangkat, misalnya --perangkat 0.')


def rekam(path: str, perangkat: int, durasi: float) -> None:
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    '-f', 'avfoundation', '-i', f':{perangkat}',
                    '-t', str(durasi), '-ac', '1', '-ar', '16000', path],
                   check=True)


def periksa(path: str) -> tuple[bool, str]:
    """Pemeriksaan mutu seketika. Kembalikan (layak, keterangan)."""
    y, sr = sf.read(path, dtype='float32')
    if y.ndim > 1:
        y = y.mean(axis=1)
    if len(y) < sr:
        return False, 'rekaman terlalu pendek'
    hening = y[:int(HENING_AWAL_DETIK * sr)]
    sisa = y[int(HENING_AWAL_DETIK * sr):]
    rms = lambda x: float(np.sqrt(np.mean(np.square(x)) + 1e-12))
    r_hening, r_sisa, puncak = rms(hening), rms(sisa), float(np.max(np.abs(y)))
    snr = 20 * np.log10(r_sisa / max(r_hening, 1e-9))
    ket = f'puncak {puncak:.2f} · SNR kasar {snr:5.1f} dB'
    if np.mean(hening == 0) > 0.5:
        # mikrofon belum mengalirkan suara (pemanasan perangkat), SNR tidak bisa dihitung
        return False, ket + ' · awal rekaman kosong digital, mikrofon belum siap'
    if puncak >= 0.99:
        return False, ket + ' · SINYAL TERPOTONG, mundurkan mikrofon atau kecilkan gain'
    if puncak < 0.02:
        return False, ket + ' · nyaris senyap, periksa mikrofon'
    if r_sisa < 2 * r_hening:
        return False, ket + ' · ucapan tidak terdeteksi, mungkin terlalu pelan atau terlambat'
    if rms(y[:int(0.8 * sr)]) > 0.6 * r_sisa:
        return False, ket + ' · ucapan dimulai terlalu cepat, sisakan hening di awal'
    # awal dan akhir ucapan dari bingkai 50 ms; ambang di tengah (dalam dB) antara lantai derau dan puncak ucapan
    f = int(0.05 * sr)
    bingkai = np.sqrt(np.mean(np.square(y[:len(y) // f * f].reshape(-1, f)), axis=1)) + 1e-9
    aktif = np.flatnonzero(bingkai > np.sqrt(np.median(bingkai[:int(0.6 * sr) // f]) * bingkai.max()))
    if aktif.size and aktif[0] * f / sr < HENING_AWAL_DETIK:
        # segmen derau untuk SNR (1,2 detik pertama) ikut berisi ucapan
        return False, ket + f' · ucapan dimulai pada {aktif[0] * f / sr:.1f} s, tunggu dua detik setelah Enter'
    if aktif.size and (aktif[-1] + 1) * f / sr > len(y) / sr - 0.2:
        return False, ket + ' · ucapan terpotong di akhir rekaman'
    return True, ket


# ── program utama ────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--daftar-perangkat', action='store_true', help='tampilkan perangkat audio lalu keluar')
    ap.add_argument('--jarak', type=int, choices=JARAK, help='jarak mikrofon (cm)')
    ap.add_argument('--derau', choices=DERAU, help='kondisi derau')
    ap.add_argument('--perangkat', type=int, default=0, help='indeks perangkat audio ffmpeg')
    ap.add_argument('--durasi', type=float, default=8.0, help='panjang tiap rekaman (detik)')
    ap.add_argument('--jumlah', type=int, default=12, help='jumlah ucapan per kondisi')
    ap.add_argument('--out', default='~/finsense_pengukuran', help='folder keluaran')
    args = ap.parse_args()

    if args.daftar_perangkat:
        daftar_perangkat(); return
    if args.jarak is None or args.derau is None:
        ap.error('sediakan --jarak dan --derau (atau --daftar-perangkat)')

    produk = daftar_produk(args.jumlah)
    out = os.path.expanduser(args.out)
    kondisi = f'{args.jarak}cm_{args.derau}'
    folder = os.path.join(out, kondisi)
    os.makedirs(folder, exist_ok=True)
    manifest = os.path.join(out, 'manifest.csv')
    sudah = set()
    if os.path.exists(manifest):
        with open(manifest, encoding='utf-8') as f:
            sudah = {b['filename'] for b in csv.DictReader(f)}

    print(f'\nKondisi  : jarak {args.jarak} cm, derau {args.derau}')
    print(f'Keluaran : {folder}')
    print(f'Ucapan   : {len(produk)} nama produk, {args.durasi:.0f} detik per rekaman')
    print('Alur     : Enter untuk merekam · diam dua detik dahulu · ucapkan nama produk sekali\n')

    baru = 0
    for i, nama in enumerate(produk, 1):
        berkas = f'{i:02d}_{slug(nama)}.wav'
        relatif = os.path.join(kondisi, berkas)
        path = os.path.join(folder, berkas)
        if relatif in sudah:
            print(f'[{i:2d}/{len(produk)}] sudah ada, dilewati: {berkas}')
            continue
        while True:
            print(f'\n[{i:2d}/{len(produk)}] ucapkan: "{nama}"')
            jawab = input('          Enter = rekam · l = lewati · s = selesai : ').strip().lower()
            if jawab == 's':
                print(f'\nSesi dihentikan. {baru} rekaman baru tercatat di manifest.')
                return
            if jawab == 'l':
                break
            print('          merekam…', flush=True)
            rekam(path, args.perangkat, args.durasi)
            layak, ket = periksa(path)
            print(f'          {"OK  " if layak else "ULANG"} · {ket}')
            if layak or input('          Enter = rekam ulang · p = pakai saja : ').strip().lower() == 'p':
                # langsung ditulis, supaya Ctrl+C di tengah kondisi tidak menghilangkan rekaman yang sudah OK
                simpan(manifest, [{'filename': relatif, 'jarak_cm': args.jarak,
                                   'derau': args.derau, 'produk': nama, 'teks': nama}])
                baru += 1
                break

    print(f'\nSelesai. {baru} rekaman baru pada kondisi {kondisi}, manifest: {manifest}')
    print('Lanjutkan ke kondisi berikutnya, atau olah hasilnya dengan pengukuran/ukur_kondisi.py.')


def simpan(manifest: str, baris: list[dict]) -> None:
    if not baris:
        return
    baru = not os.path.exists(manifest)
    with open(manifest, 'a', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['filename', 'jarak_cm', 'derau', 'produk', 'teks'])
        if baru:
            w.writeheader()
        w.writerows(baris)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nDihentikan.')
        sys.exit(1)

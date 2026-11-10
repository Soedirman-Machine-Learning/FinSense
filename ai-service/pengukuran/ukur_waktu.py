"""
Pengukur waktu tanggap berlapis (RM3, Tabel 4.17)
=================================================

Mengukur waktu tanggap pada lapisan-lapisan yang berbeda memakai penghitung
waktu yang memang sudah terpasang di sistem, bukan perkiraan:

  Inferensi model            waktu_inferensi_ms          dari layanan FastAPI
  Layanan AI (total)         response_time_ms            dari layanan FastAPI
  Back-end aplikasi          backend_response_time_ms    dari Express
  Peramban (ujung ke ujung)  performance.now() di InputPos.jsx, atau kolom
                             "Time" DevTools; masukkan lewat --har atau --peramban

Permintaan pertama sengaja dibuang sebagai pemanasan, sebab kondisi dingin
sudah dilaporkan terpisah pada Tabel 4.16.

Menjalankan (dari folder ai-service, layanan AI dan back-end harus hidup):
    ./venv/bin/python pengukuran/ukur_waktu.py \\
        --audio ~/finsense_pengukuran/30cm_sunyi/01_sedaap-goreng.wav \\
        --ulang 50 --har ~/Downloads/localhost.har
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time

import requests

LAPISAN = [
    ('Inferensi model', 'waktu_inferensi_ms'),
    ('Layanan AI (total)', 'response_time_ms'),
    ('Back-end aplikasi', 'backend_response_time_ms'),
    ('Peramban (ujung ke ujung)', 'peramban_ms'),
]


def persentil(nilai: list[float], p: float) -> float:
    """Persentil dengan interpolasi linear (metode yang sama dengan numpy)."""
    urut = sorted(nilai)
    if not urut:
        return float('nan')
    k = (len(urut) - 1) * p / 100
    bawah, atas = int(k), min(int(k) + 1, len(urut) - 1)
    return urut[bawah] + (urut[atas] - urut[bawah]) * (k - bawah)


def kirim(url: str, path: str, ulang: int, label: str, jeda: float = 0.0) -> list[dict]:
    hasil = []
    for i in range(ulang + 1):                      # +1 = pemanasan
        if i and jeda:
            # Permintaan beruntun tanpa jeda membuat inferensi melambat bertahap
            # (50 → 90 ms) setelah puluhan permintaan; kasir sungguhan memberi
            # jeda beberapa detik antarperintah.
            time.sleep(jeda)
        with open(path, 'rb') as f:
            berkas = {'audio': (os.path.basename(path), f, 'audio/wav')}
            t0 = time.perf_counter()
            try:
                r = requests.post(url, files=berkas, data={'transcript': '', 'jumlah': 0}, timeout=120)
            except requests.RequestException as e:
                sys.exit(f'{label}: gagal menghubungi {url} — {e}')
        klien_ms = (time.perf_counter() - t0) * 1000
        if r.status_code != 200:
            sys.exit(f'{label}: {url} membalas {r.status_code} — {r.text[:200]}')
        d = r.json()
        if i == 0:
            print(f'  pemanasan {label}: {klien_ms:.0f} ms (dibuang)')
            continue
        d['klien_ms'] = round(klien_ms, 1)
        hasil.append(d)
        if i % 10 == 0:
            print(f'  {label}: {i}/{ulang}', flush=True)
    return hasil


def dari_har(path: str, pola: str) -> list[float]:
    """Durasi permintaan yang cocok dengan pola URL, dari berkas HAR DevTools."""
    with open(os.path.expanduser(path), encoding='utf-8') as f:
        har = json.load(f)
    return [e['time'] for e in har['log']['entries']
            if pola in e['request']['url'] and e['request']['method'] == 'POST']


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--audio', required=True, help='satu berkas WAV yang dikirim berulang')
    ap.add_argument('--ulang', type=int, default=50, help='jumlah permintaan per lapisan')
    ap.add_argument('--jeda', type=float, default=0.0, help='jeda antarpermintaan (detik)')
    ap.add_argument('--ai', default='http://127.0.0.1:8000/voice/', help='URL layanan FastAPI')
    ap.add_argument('--backend', default='http://localhost:5001/api/voice', help='URL back-end Express')
    ap.add_argument('--lewati-backend', action='store_true', help='ukur layanan AI saja')
    ap.add_argument('--har', help='berkas HAR dari DevTools untuk lapisan peramban')
    ap.add_argument('--pola-har', default='/api/voice', help='pola URL yang dicari di dalam HAR')
    ap.add_argument('--peramban', help='daftar waktu peramban dalam ms, dipisah koma')
    ap.add_argument('--out', default='~/finsense_pengukuran/waktu_tanggap.csv')
    args = ap.parse_args()

    audio = os.path.expanduser(args.audio)
    if not os.path.exists(audio):
        sys.exit(f'berkas audio tidak ditemukan: {audio}')

    print(f'Audio uji : {audio}')
    print(f'Permintaan: {args.ulang} per lapisan (di luar pemanasan)\n')
    ukuran = {}

    print('Layanan AI (FastAPI)')
    ai = kirim(args.ai, audio, args.ulang, 'layanan AI', args.jeda)
    ukuran['waktu_inferensi_ms'] = [d['waktu_inferensi_ms'] for d in ai]
    ukuran['response_time_ms'] = [d['response_time_ms'] for d in ai]

    if not args.lewati_backend:
        print('\nBack-end aplikasi (Express)')
        be = kirim(args.backend, audio, args.ulang, 'back-end', args.jeda)
        kunci = 'backend_response_time_ms'
        ukuran[kunci] = [d[kunci] for d in be if d.get(kunci) is not None]
        ukuran['klien_ke_backend_ms'] = [d['klien_ms'] for d in be]

    if args.har:
        ukuran['peramban_ms'] = dari_har(args.har, args.pola_har)
        print(f'\nHAR: {len(ukuran["peramban_ms"])} permintaan cocok dengan "{args.pola_har}"')
    elif args.peramban:
        ukuran['peramban_ms'] = [float(x.strip().replace(',', '.')) for x in args.peramban.split(',') if x.strip()]

    print('\n' + '=' * 72)
    print('TABEL 4.17 — Waktu Tanggap Ujung ke Ujung')
    print('=' * 72)
    print(f'{"Lapisan pengukuran":30s}{"n":>5s}{"Persentil ke-50":>18s}{"Persentil ke-95":>18s}')
    baris = []
    for label, kunci in LAPISAN:
        nilai = ukuran.get(kunci) or []
        if not nilai:
            print(f'{label:30s}{"—":>5s}{"belum diukur":>18s}{"belum diukur":>18s}')
            continue
        p50, p95 = persentil(nilai, 50), persentil(nilai, 95)
        print(f'{label:30s}{len(nilai):5d}{f"{p50:.0f} ms":>18s}{f"{p95:.0f} ms":>18s}')
        baris.append({'lapisan': label, 'n': len(nilai), 'p50_ms': round(p50, 1), 'p95_ms': round(p95, 1),
                      'rerata_ms': round(statistics.mean(nilai), 1),
                      'min_ms': round(min(nilai), 1), 'maks_ms': round(max(nilai), 1)})

    tambahan = ukuran.get('klien_ke_backend_ms')
    if tambahan:
        print(f'\nCatatan: waktu skrip ini ke back-end (bukan peramban) p50 '
              f'{persentil(tambahan, 50):.0f} ms, p95 {persentil(tambahan, 95):.0f} ms.')
    if not ukuran.get('peramban_ms'):
        print('\nLapisan peramban belum terisi. Rekam 15–20 permintaan lewat aplikasi, simpan HAR '
              'dari tab Network DevTools, lalu ulangi dengan --har berkas.har.')

    out = os.path.expanduser(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    import csv
    with open(out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['lapisan', 'n', 'p50_ms', 'p95_ms', 'rerata_ms', 'min_ms', 'maks_ms'])
        w.writeheader(); w.writerows(baris)
    print(f'\nTersimpan: {out}')


if __name__ == '__main__':
    main()

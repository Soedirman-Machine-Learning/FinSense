"""
Augmentasi akustik untuk korpus Tahap 1
=======================================

Dataset asli FinSense direkam dalam kondisi yang terlalu seragam: satu gaya
bicara, ruangan yang sama, langsung disimpan sebagai WAV bersih. Model yang
dilatih di atasnya rapuh begitu masuk kondisi nyata — mikrofon HP, warung ramai,
dan (yang paling sering terlewat) kompresi Opus dari browser.

Setiap fungsi di sini mengembalikan array float32 pada sample rate yang sama.
Semua memakai np.random.Generator yang di-pass eksplisit supaya korpus yang
dihasilkan bisa direproduksi persis.

Urutan penerapan di `random_chain()` dipilih meniru urutan fisiknya di dunia
nyata: bicara (speed) -> ruangan (reverb) -> lingkungan (noise) -> jarak ke
mikrofon (gain) -> perekaman browser (codec) -> tombol ditekan lebih awal
(silence). Membalik urutannya, misalnya menambah noise setelah codec, akan
menghasilkan sinyal yang tidak mungkin terjadi di produksi.
"""

from __future__ import annotations

import os
import subprocess
import tempfile

import numpy as np

SR = 16000


# ─────────────────────────────────────────────────────────────────────
def pad_silence(y: np.ndarray, rng, sr: int = SR,
                lead_range=(0.0, 3.0), tail_range=(0.0, 1.5)) -> np.ndarray:
    """Tambah keheningan di depan/belakang.

    Ini augmentasi terpenting untuk masalah yang sedang kita perbaiki. Pengguna
    menekan tombol mikrofon lalu diam sejenak sebelum bicara, sementara model
    ini dilatih pada rekaman yang sudah di-trim rapi — pada uji internal, jeda
    3 detik di depan menjatuhkan skor dari 90% ke 43%. Melatih dengan jeda acak
    membuat posisi ucapan berhenti menjadi fitur.

    Keheningannya tidak benar-benar nol melainkan noise lantai yang sangat
    pelan, karena digital silence murni juga tidak pernah muncul di rekaman
    mikrofon sungguhan.
    """
    lead = int(rng.uniform(*lead_range) * sr)
    tail = int(rng.uniform(*tail_range) * sr)
    floor = float(np.abs(y).max()) * 1e-3 if y.size else 1e-4
    head = rng.normal(0, floor, lead).astype(np.float32)
    foot = rng.normal(0, floor, tail).astype(np.float32)
    return np.concatenate([head, y, foot]).astype(np.float32)


def speed_perturb(y: np.ndarray, rng, sr: int = SR,
                  factors=(0.9, 1.0, 1.1)) -> np.ndarray:
    """Ubah kecepatan bicara sekaligus pitch (resampling sederhana).

    Ini speed perturbation ala Kaldi, bukan time-stretch: durasi dan pitch
    berubah bersama, seperti orang yang memang bicara lebih cepat atau lebih
    lambat. Murah dan terbukti efektif untuk ASR.
    """
    f = float(rng.choice(factors))
    if f == 1.0:
        return y
    n = int(round(len(y) / f))
    if n < 2:
        return y
    idx = np.linspace(0, len(y) - 1, n)
    return np.interp(idx, np.arange(len(y)), y).astype(np.float32)


def apply_gain(y: np.ndarray, rng, db_range=(-10.0, 6.0)) -> np.ndarray:
    """Ubah level sinyal, meniru jarak bicara ke mikrofon yang berbeda-beda."""
    gain = 10 ** (rng.uniform(*db_range) / 20)
    out = y * gain
    peak = np.abs(out).max()
    if peak > 0.99:  # cegah clipping keras
        out = out * (0.99 / peak)
    return out.astype(np.float32)


def add_noise(y: np.ndarray, rng, sr: int = SR, snr_range=(5.0, 20.0)) -> np.ndarray:
    """Campur derau latar pada SNR tertentu.

    Tanpa rekaman ambience warung yang sungguhan, deraunya disintesis sebagai
    pink-ish noise (spektrum meluruh ~1/f) plus sedikit dengung jala-jala 50 Hz.
    Itu jauh lebih menyerupai keramaian ruangan daripada white noise, yang
    energinya rata di frekuensi tinggi dan mudah dipelajari model sebagai
    pola yang bisa diabaikan begitu saja.

    Kalau nanti tim punya rekaman ambience asli, ganti fungsi ini dengan
    pencampuran berkas — itu lebih baik daripada derau sintetis mana pun.
    """
    n = len(y)
    if n == 0:
        return y
    white = rng.normal(0, 1, n)
    spec = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, 1 / sr)
    shape = 1.0 / np.sqrt(np.maximum(freqs, 1.0))       # ~1/f dalam daya
    noise = np.fft.irfft(spec * shape, n)
    hum = 0.05 * np.sin(2 * np.pi * 50 * np.arange(n) / sr)
    noise = noise + hum * noise.std()

    sig_pow = float(np.mean(y ** 2))
    noise_pow = float(np.mean(noise ** 2))
    if sig_pow <= 0 or noise_pow <= 0:
        return y
    snr = rng.uniform(*snr_range)
    scale = np.sqrt(sig_pow / (noise_pow * 10 ** (snr / 10)))
    return (y + noise * scale).astype(np.float32)


def add_reverb(y: np.ndarray, rng, sr: int = SR,
               rt60_range=(0.1, 0.4)) -> np.ndarray:
    """Konvolusi dengan impulse response eksponensial sintetis.

    Meniru pantulan ruangan kecil berdinding keras — warung, kios, ruang tamu.
    IR-nya derau yang meluruh secara eksponensial; kasar, tapi cukup untuk
    mengajari model bahwa ekor pantulan bukan bagian dari fonem.
    """
    rt60 = rng.uniform(*rt60_range)
    n_ir = int(rt60 * sr)
    if n_ir < 8 or len(y) == 0:
        return y
    t = np.arange(n_ir) / sr
    ir = rng.normal(0, 1, n_ir) * np.exp(-6.9 * t / rt60)
    ir[0] += 1.0                      # jalur langsung
    ir = ir / np.sqrt(np.sum(ir ** 2))
    out = np.convolve(y, ir)[:len(y)]
    peak = np.abs(out).max()
    if peak > 0.99:
        out = out * (0.99 / peak)
    return out.astype(np.float32)


def opus_roundtrip(y: np.ndarray, rng, sr: int = SR,
                   bitrates=(16000, 24000, 32000, 48000)) -> np.ndarray:
    """Encode ke WebM/Opus lalu decode lagi — meniru audio dari browser.

    Ini yang paling sering terlewat dan paling langsung berpengaruh. Frontend
    merekam dengan MediaRecorder sebagai audio/webm (Opus), sedangkan model
    dilatih pada WAV bersih. Opus pada bitrate rendah membuang detail frekuensi
    tinggi dan menerapkan noise shaping — persis wilayah yang membedakan /s/
    dari /f/, dan konsonan itu penting untuk membedakan nama produk.

    Butuh ffmpeg (sudah jadi prasyarat FinSense di README).
    """
    import soundfile as sf

    br = int(rng.choice(bitrates))
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, 'in.wav')
        mid = os.path.join(tmp, 'mid.webm')
        dst = os.path.join(tmp, 'out.wav')
        sf.write(src, y, sr)
        for cmd in (
            ['ffmpeg', '-v', 'error', '-y', '-i', src,
             '-c:a', 'libopus', '-b:a', str(br), mid],
            ['ffmpeg', '-v', 'error', '-y', '-i', mid,
             '-ar', str(sr), '-ac', '1', dst],
        ):
            try:
                subprocess.run(cmd, check=True, capture_output=True)
            except (subprocess.CalledProcessError, FileNotFoundError):
                return y  # ffmpeg tidak ada / gagal: lewati, jangan gagalkan korpus
        out, _ = sf.read(dst, dtype='float32')
    return out if out.ndim == 1 else out.mean(axis=1).astype(np.float32)


# ─────────────────────────────────────────────────────────────────────
# Peluang tiap augmentasi dipakai dalam satu rantai. Dipilih supaya sebagian
# besar klip kena beberapa augmentasi sekaligus (kondisi nyata memang menumpuk),
# tapi tetap ada klip yang nyaris bersih agar model tidak kehilangan acuan.
CHAIN_PROBS = {
    'speed': 0.5,
    'reverb': 0.35,
    'noise': 0.6,
    'gain': 0.5,
    'opus': 0.5,
    'silence': 0.8,   # paling tinggi: inilah perbaikan yang paling kita butuhkan
}


def random_chain(y: np.ndarray, rng, sr: int = SR,
                 probs: dict | None = None,
                 lead_range=(0.0, 3.0),
                 tail_range=(0.0, 1.5)) -> tuple[np.ndarray, list[str]]:
    """Terapkan rantai augmentasi acak. -> (audio, daftar augmentasi terpakai).

    lead_range/tail_range dibatasi oleh pemanggil sesuai sisa anggaran durasi,
    supaya klip hasilnya tetap muat di jendela masukan model.
    """
    p = dict(CHAIN_PROBS if probs is None else probs)
    used = []
    if rng.random() < p['speed']:
        before = len(y)
        y = speed_perturb(y, rng, sr)
        if len(y) != before:
            used.append('speed')
    if rng.random() < p['reverb']:
        y = add_reverb(y, rng, sr)
        used.append('reverb')
    if rng.random() < p['noise']:
        y = add_noise(y, rng, sr)
        used.append('noise')
    if rng.random() < p['gain']:
        y = apply_gain(y, rng)
        used.append('gain')
    if rng.random() < p['opus']:
        y = opus_roundtrip(y, rng, sr)
        used.append('opus')
    if rng.random() < p['silence'] and (lead_range[1] > 0 or tail_range[1] > 0):
        y = pad_silence(y, rng, sr, lead_range, tail_range)
        used.append('silence')
    return y.astype(np.float32), used

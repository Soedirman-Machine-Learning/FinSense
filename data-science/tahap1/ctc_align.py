"""
Forced alignment CTC — menemukan batas kata di dalam rekaman
=============================================================

Ini fondasi Tahap 1. Dataset FinSense berisi 5100 rekaman manusia (6.3 jam),
dan sebagian besar menyebut nama produk di TENGAH kalimat:

    "jual abc kecap asin enam ratus dua puluh mililiter dua bungkus ... rupiah"

Model jadi kurang terlatih pada ucapan yang berhenti tepat di nama produk. Cara
termurah untuk memperbaikinya bukan merekam ulang, melainkan MEMOTONG rekaman
yang sudah ada: kalau kita tahu persis frame ke berapa tiap kata diucapkan, satu
rekaman kalimat penuh bisa menghasilkan potongan "produk saja", "intent +
produk", "produk + jumlah" — semuanya audio manusia asli dengan label yang pasti
benar.

Batas kata itu dicari dengan forced alignment: transkrip acuannya sudah
diketahui, jadi kita tidak perlu menebak apa yang diucapkan (itu tugas decoding
biasa), cukup mencari jalur penyelarasan paling mungkin antara transkrip itu dan
posteriorgram model. Algoritmanya Viterbi di atas sekuens CTC yang diperluas:

    l' = [blank, y1, blank, y2, blank, ..., yL, blank]        (panjang 2L+1)

dengan transisi yang diizinkan dari state s ke s, s+1, dan s+2 (lompat dua hanya
boleh kalau state tujuannya bukan blank dan hurufnya berbeda dari huruf dua
state sebelumnya — persis aturan CTC yang mengharuskan blank di antara huruf
kembar).

Kenapa tidak pakai transkrip greedy saja? Karena greedy sering salah eja
("ketap" untuk "kecap", "asina" untuk "asin enam"), dan batas kata yang
diturunkan darinya ikut meleset. Forced alignment memakai transkrip yang BENAR,
jadi batasnya tetap akurat meski model salah mengeja.

Dijalankan dengan venv ai-service (butuh tensorflow + librosa):
    ../../ai-service/venv/bin/python ctc_align.py --demo
"""

from __future__ import annotations

import json
from typing import NamedTuple, Sequence

import numpy as np

NEG_INF = -1e30


class WordSpan(NamedTuple):
    word: str
    start_frame: int   # frame keluaran model (inklusif)
    end_frame: int     # frame keluaran model (inklusif)


def viterbi_align(log_probs: np.ndarray, labels: Sequence[int],
                  blank_idx: int) -> np.ndarray:
    """Jalur CTC paling mungkin untuk `labels` di atas `log_probs`.

    log_probs: (T, n_classes) sudah dalam log. labels: indeks karakter acuan.
    Mengembalikan array panjang T berisi indeks state di l' untuk tiap frame.
    """
    T = log_probs.shape[0]
    L = len(labels)
    S = 2 * L + 1

    # l'[s]: blank di posisi genap, huruf ke-(s//2) di posisi ganjil
    ext = np.full(S, blank_idx, np.int32)
    ext[1::2] = labels

    if T < S - np.count_nonzero(ext[1::2][1:] == ext[1::2][:-1]) - (L - 1):
        # Tidak cukup frame untuk mengeluarkan seluruh label sama sekali.
        raise ValueError(f'frame tidak cukup untuk alignment: T={T}, butuh >= {L}')

    dp = np.full((T, S), NEG_INF, np.float64)
    back = np.zeros((T, S), np.int8)  # 0 = tetap, 1 = maju 1, 2 = maju 2

    dp[0, 0] = log_probs[0, ext[0]]
    if S > 1:
        dp[0, 1] = log_probs[0, ext[1]]

    # Lompat dua state hanya sah kalau tujuannya huruf (ganjil) dan huruf itu
    # berbeda dari huruf dua state sebelumnya; kalau sama, CTC mewajibkan blank
    # di antaranya sehingga lompatan itu terlarang.
    can_skip = np.zeros(S, bool)
    can_skip[3::2] = ext[3::2] != ext[1:-2:2]

    for t in range(1, T):
        stay = dp[t - 1]
        step = np.concatenate([[NEG_INF], dp[t - 1, :-1]])
        skip = np.concatenate([[NEG_INF, NEG_INF], dp[t - 1, :-2]])
        skip = np.where(can_skip, skip, NEG_INF)

        stacked = np.stack([stay, step, skip])
        choice = np.argmax(stacked, axis=0)
        dp[t] = stacked[choice, np.arange(S)] + log_probs[t, ext]
        back[t] = choice

    # Jalur sah berakhir di huruf terakhir atau blank penutup.
    end = S - 1 if dp[T - 1, S - 1] >= dp[T - 1, S - 2] else S - 2
    path = np.zeros(T, np.int32)
    s = end
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(back[t, s])
    return path


def path_to_word_spans(path: np.ndarray, text: str) -> list[WordSpan]:
    """Ubah jalur state jadi rentang frame per kata.

    Spasi ikut jadi label di dalam `text`, jadi indeks karakter di l' bisa
    dipetakan langsung ke kata ke berapa.
    """
    # char_of_state[s] = indeks karakter dalam text, atau -1 untuk blank
    char_index = np.full(2 * len(text) + 1, -1, np.int32)
    char_index[1::2] = np.arange(len(text))

    # kata ke berapa untuk tiap karakter (spasi -> -1)
    word_of_char = np.full(len(text), -1, np.int32)
    w = 0
    for i, ch in enumerate(text):
        if ch == ' ':
            w += 1
        else:
            word_of_char[i] = w
    n_words = w + 1

    first = np.full(n_words, -1, np.int32)
    last = np.full(n_words, -1, np.int32)
    for t, s in enumerate(path):
        ci = char_index[s]
        if ci < 0:
            continue
        wi = word_of_char[ci]
        if wi < 0:
            continue
        if first[wi] < 0:
            first[wi] = t
        last[wi] = t

    words = text.split(' ')
    spans = []
    for i, word in enumerate(words):
        if i < n_words and first[i] >= 0:
            spans.append(WordSpan(word, int(first[i]), int(last[i])))
    return spans


class Aligner:
    """Membungkus model v11 + vokab karakter untuk forced alignment."""

    def __init__(self, model_path: str, char_vocab_path: str):
        import keras
        import tensorflow as tf

        # SpecAugment perlu terdaftar agar .keras bisa di-deserialize.
        @keras.saving.register_keras_serializable(package='finsense', name='SpecAugment')
        class SpecAugment(keras.layers.Layer):
            def __init__(self, freq_mask=12, time_mask=30, n_freq=2, n_time=2, **kw):
                super().__init__(**kw)
                self.freq_mask, self.time_mask = freq_mask, time_mask
                self.n_freq, self.n_time = n_freq, n_time

            def call(self, inputs, training=None):
                return inputs

            def get_config(self):
                cfg = super().get_config()
                cfg.update(freq_mask=self.freq_mask, time_mask=self.time_mask,
                           n_freq=self.n_freq, n_time=self.n_time)
                return cfg

        with open(char_vocab_path, encoding='utf-8') as f:
            vocab = json.load(f)
        self.char2idx = vocab['char2idx']
        self.blank_idx = vocab['blank_idx']
        self.cfg = {k: vocab[k] for k in
                    ('sample_rate', 'n_mels', 'n_fft', 'win_length',
                     'hop_length', 'max_frames')}

        self.model = keras.models.load_model(model_path, compile=False)

        @tf.function(input_signature=[tf.TensorSpec(
            [1, self.cfg['max_frames'], self.cfg['n_mels']], tf.float32)])
        def infer(x):
            return self.model({'log_mel': x}, training=False)

        self._infer = infer
        self._infer(np.zeros((1, self.cfg['max_frames'], self.cfg['n_mels']), np.float32))

        # Rasio downsampling waktu model (MaxPooling1D stride 2 -> 2 frame mel
        # per frame keluaran). Dihitung, bukan diasumsikan.
        self.subsample = self.cfg['max_frames'] // int(
            self._infer(np.zeros((1, self.cfg['max_frames'],
                                  self.cfg['n_mels']), np.float32)).shape[1])

    def posteriors(self, samples: np.ndarray) -> tuple[np.ndarray, int]:
        """(log-probs (T_out, C), jumlah frame keluaran yang benar-benar berisi audio)."""
        import librosa

        S = librosa.feature.melspectrogram(
            y=samples, sr=self.cfg['sample_rate'], n_mels=self.cfg['n_mels'],
            n_fft=self.cfg['n_fft'], hop_length=self.cfg['hop_length'],
            win_length=self.cfg['win_length'])
        S_db = librosa.power_to_db(S, ref=np.max).T
        S_db = ((S_db - S_db.mean()) / (S_db.std() + 1e-8)).astype(np.float32)

        n_real_mel = min(S_db.shape[0], self.cfg['max_frames'])
        if S_db.shape[0] < self.cfg['max_frames']:
            S_db = np.vstack([S_db, np.zeros(
                (self.cfg['max_frames'] - S_db.shape[0], self.cfg['n_mels']), np.float32)])
        else:
            S_db = S_db[:self.cfg['max_frames']]

        probs = self._infer(S_db[None]).numpy()[0]
        n_real_out = max(1, int(np.ceil(n_real_mel / self.subsample)))
        return np.log(probs + 1e-9), n_real_out

    def align(self, samples: np.ndarray, transcript: str) -> list[WordSpan]:
        """Rentang frame keluaran untuk tiap kata di `transcript`."""
        text = ' '.join(transcript.lower().split())
        labels = [self.char2idx[c] for c in text if c in self.char2idx]
        if not labels:
            return []
        log_probs, n_real = self.posteriors(samples)
        # Alignment dibatasi ke frame yang benar-benar berisi audio; ekor padding
        # tidak boleh ikut menyerap huruf.
        path = viterbi_align(log_probs[:n_real], labels, self.blank_idx)
        return path_to_word_spans(path, text)

    def frames_to_samples(self, start_frame: int, end_frame: int,
                          n_samples: int, pad_frames: int = 2) -> tuple[int, int]:
        """Rentang frame keluaran -> rentang indeks sampel audio."""
        hop = self.cfg['hop_length'] * self.subsample
        lo = max(0, (start_frame - pad_frames) * hop)
        hi = min(n_samples, (end_frame + 1 + pad_frames) * hop)
        return int(lo), int(hi)


def _demo():
    import argparse
    import glob
    import os

    import soundfile as sf

    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='../../ai-service/model_v11_ctc/finsense_ctc_v11.keras')
    ap.add_argument('--vocab', default='../../ai-service/model_v11_ctc/char_vocab.json')
    ap.add_argument('--audio', default='../data/raw/audio/sample')
    ap.add_argument('--demo', action='store_true')
    args = ap.parse_args()

    # Transkrip acuan untuk 3 sampel yang ada di repo (produk 1, qty 1/2/3).
    refs = {
        '1': 'jual kecap asin enam ratus dua puluh mililiter satu bungkus '
             'delapan belas ribu rupiah',
        '2': 'jual abc kecap asin enam ratus dua puluh mililiter dua bungkus '
             'tiga puluh enam ribu rupiah',
        '3': 'jual abc kecap asin enam ratus dua puluh mililiter tiga bungkus '
             'lima puluh empat ribu rupiah',
    }
    aligner = Aligner(args.model, args.vocab)
    for path in sorted(glob.glob(os.path.join(args.audio, '*.wav'))):
        key = os.path.basename(path)[0]
        if key not in refs:
            continue
        import librosa
        y, sr = librosa.load(path, sr=aligner.cfg['sample_rate'])
        spans = aligner.align(y, refs[key])
        print(f'\n{path}  ({len(y) / sr:.2f} s)')
        for s in spans:
            t0 = s.start_frame * aligner.cfg['hop_length'] * aligner.subsample / sr
            t1 = (s.end_frame + 1) * aligner.cfg['hop_length'] * aligner.subsample / sr
            print(f'   {s.word:12s} {t0:5.2f}s .. {t1:5.2f}s')


if __name__ == '__main__':
    _demo()

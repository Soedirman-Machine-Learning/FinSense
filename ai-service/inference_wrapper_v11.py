"""
FinSense v11 Inference — CNN-BiGRU-CTC Produk Recognizer
=========================================================

v10 was a fixed-vocab classifier (single softmax over produk_vocab).
v11 is a CTC sequence model: it transcribes the audio into a raw
character sequence (e.g. "aqua enam ratus mililiter"), which we then
fuzzy-match against produk_vocab to get the final produk label.

Pipeline:
  audio -> log-mel -> CNN-BiGRU -> per-frame char logits -> CTC greedy
  decode -> raw text -> fuzzy match against produk_vocab -> produk + harga

Usage:
    from inference_wrapper_v11 import FinSenseEngineV11

    engine = FinSenseEngineV11(
        model_path='model_v11_ctc/finsense_ctc_v11.keras',
        char_vocab_path='model_v11_ctc/char_vocab.json',
        unit_price_path='model_v10/unit_price_lookup.json',
    )
    result = engine.process(audio_path='rec.wav', transcript='jual aqua dua botol')
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Optional

import numpy as np

from inference_wrapper_v10 import parse_jumlah, _QTY, _QTY_UNITS_STRONG


# ─────────────────────────────────────────────────────────────────────
# SpecAugment — training-only augmentation layer baked into the .keras
# graph. At inference it is a pure pass-through, but Keras still needs the
# class definition to deserialize the model. Registered under the same
# package/name used at training time ('finsense>SpecAugment').
# ─────────────────────────────────────────────────────────────────────
def _register_spec_augment():
    import keras

    @keras.saving.register_keras_serializable(package="finsense", name="SpecAugment")
    class SpecAugment(keras.layers.Layer):
        def __init__(self, freq_mask=12, time_mask=30, n_freq=2, n_time=2, **kwargs):
            super().__init__(**kwargs)
            self.freq_mask = freq_mask
            self.time_mask = time_mask
            self.n_freq = n_freq
            self.n_time = n_time

        def call(self, inputs, training=None):
            return inputs  # no-op at inference

        def get_config(self):
            cfg = super().get_config()
            cfg.update(freq_mask=self.freq_mask, time_mask=self.time_mask,
                       n_freq=self.n_freq, n_time=self.n_time)
            return cfg

    return SpecAugment


def audio_to_logmel(audio_path, cfg):
    import librosa
    y, sr = librosa.load(str(audio_path), sr=cfg['sample_rate'])
    S = librosa.feature.melspectrogram(
        y=y, sr=sr, n_mels=cfg['n_mels'], n_fft=cfg['n_fft'],
        hop_length=cfg['hop_length'], win_length=cfg['win_length'])
    S_db = librosa.power_to_db(S, ref=np.max).T
    S_db = (S_db - S_db.mean()) / (S_db.std() + 1e-8)
    T = S_db.shape[0]
    max_frames = cfg['max_frames']
    if T < max_frames:
        S_db = np.vstack([S_db, np.zeros((max_frames - T, cfg['n_mels']), dtype=np.float32)])
    else:
        S_db = S_db[:max_frames]
    return S_db.astype(np.float32)


def ctc_greedy_decode(logits: np.ndarray, idx2char: dict, blank_idx: int) -> str:
    """logits: (time, n_classes). Greedy argmax + collapse repeats + drop blanks."""
    ids = np.argmax(logits, axis=-1)
    chars = []
    prev = None
    for i in ids:
        i = int(i)
        if i != blank_idx and i != prev:
            chars.append(idx2char.get(str(i), ''))
        prev = i
    return ''.join(chars)


_INTENT_WORDS = {'jual', 'beli', 'tambah', 'jualan'}


def extract_produk_span(text: str) -> str:
    """Isolate the produk portion from a full CTC transcript.

    Transcript shape is roughly: "<intent> <produk...> <qty> <unit> <harga> rupiah".
    Drop the leading intent word and cut everything from the quantity marker
    (qty-word + strong unit, e.g. "dua botol") onward, so price/qty words don't
    pollute the match. Produk names themselves keep their number words intact.
    """
    words = text.lower().split()
    if words and words[0] in _INTENT_WORDS:
        words = words[1:]
    for i, w in enumerate(words):
        if w in _QTY and i + 1 < len(words) and words[i + 1] in _QTY_UNITS_STRONG:
            words = words[:i]
            break
    return ' '.join(words)


def fuzzy_match_produk(text: str, produk_vocab: list[str]):
    """Match a (possibly noisy) CTC transcript to the closest produk in vocab.

    Combines word-level recall (handles word drops) with character-level
    similarity (handles mis-spellings like 'asia'->'asin', 'kateap'->'kecap').
    """
    from difflib import SequenceMatcher

    span = extract_produk_span(text)
    twords = set(span.split())
    best, best_score = None, 0.0
    for p in produk_vocab:
        pwords = p.split()
        recall = len(set(pwords) & twords) / max(len(pwords), 1)
        char_sim = SequenceMatcher(None, span, p).ratio()
        score = 0.6 * recall + 0.4 * char_sim
        if score > best_score:
            best, best_score = p, score
    return best, best_score


class FinSenseEngineV11:
    """End-to-end: produk (CNN-BiGRU-CTC) + jumlah (transcript) + harga (computed)."""

    def __init__(self, model_path, char_vocab_path, unit_price_path):
        with open(char_vocab_path, encoding='utf-8') as f:
            vocab = json.load(f)
        self.idx2char = vocab['idx2char']
        # Arah sebaliknya dibutuhkan oleh rescoring leksikon (ctc_lexicon.py),
        # yang meng-encode nama produk jadi label CTC.
        self.char2idx = vocab['char2idx']
        self.blank_idx = vocab['blank_idx']
        self.audio_config = {
            'sample_rate': vocab['sample_rate'],
            'n_mels': vocab['n_mels'],
            'n_fft': vocab['n_fft'],
            'win_length': vocab['win_length'],
            'hop_length': vocab['hop_length'],
            'max_frames': vocab['max_frames'],
        }

        with open(unit_price_path, encoding='utf-8') as f:
            price_art = json.load(f)
        self.produk_vocab = price_art['produk_vocab']
        self.unit_price_lookup = price_art['unit_price_lookup']

        import tensorflow as tf
        _register_spec_augment()  # make SpecAugment deserializable
        # Load the .keras model (NOT the GPU-baked SavedModel) so the GRU runs
        # on CPU. tf.saved_model.load would fail with a CudnnRNNV3 OpKernel error.
        self.model = tf.keras.models.load_model(str(model_path), compile=False)

        # warm up
        dummy = np.zeros((1, self.audio_config['max_frames'], self.audio_config['n_mels']), dtype=np.float32)
        self.model({'log_mel': dummy}, training=False)
        # Sebut nama berkasnya, jangan "v11" yang di-hardcode: kelas ini juga
        # dipakai untuk memuat v12 dan seterusnya, dan pesan yang salah membuat
        # orang mengira model lama yang sedang berjalan.
        print(f"✓ Engine siap: {Path(model_path).name} "
              f"({len(self.produk_vocab)} produk, CNN-BiGRU-CTC on CPU)")

    def transcribe_produk_audio(self, audio_path):
        feat = audio_to_logmel(audio_path, self.audio_config)
        # Berikan input dalam bentuk dictionary agar sesuai dengan struktur layer 'log_mel'
        inputs = {'log_mel': feat[np.newaxis, ...]}
        probs = self.model(inputs, training=False).numpy()[0]  # (time, n_classes)
        raw_text = ctc_greedy_decode(probs, self.idx2char, self.blank_idx)
        produk, score = fuzzy_match_produk(raw_text, self.produk_vocab)
        return {'raw_text': raw_text, 'produk': produk, 'match_score': round(score, 2)}

    def process(self, audio_path, transcript: str = ''):
        produk_info = self.transcribe_produk_audio(audio_path)
        produk = produk_info['produk']
        jumlah = parse_jumlah(transcript) or 1
        unit_price = self.unit_price_lookup.get(produk, 0)
        harga = unit_price * jumlah
        return {
            'intent': 'jual',
            'produk': produk,
            'produk_raw_text': produk_info['raw_text'],
            'produk_match_score': produk_info['match_score'],
            'jumlah': jumlah,
            'unit_price': unit_price,
            'harga': harga,
            'source': {'produk': 'audio_model_ctc', 'jumlah': 'transcript'},
        }


def _demo():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--model', default='model_v11_ctc/finsense_ctc_v11.keras')
    p.add_argument('--char-vocab', default='model_v11_ctc/char_vocab.json')
    p.add_argument('--unit-price', default='model_v10/unit_price_lookup.json')
    p.add_argument('--audio', required=True)
    p.add_argument('--transcript', default='')
    args = p.parse_args()

    engine = FinSenseEngineV11(args.model, args.char_vocab, args.unit_price)
    r = engine.process(args.audio, args.transcript)
    print(json.dumps(r, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    _demo()

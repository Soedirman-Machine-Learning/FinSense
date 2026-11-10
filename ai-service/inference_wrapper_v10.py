"""
FinSense v10 Inference — End-to-End SLU Pipeline
=================================================

Combines three sources into one transaction:
  - PRODUK : deep model (v10, 96.67% test accuracy) from audio
  - JUMLAH : parsed from Web Speech transcript via id2num()
  - HARGA  : computed = unit_price_lookup[produk] x jumlah  (exact)

Why this split? Diagnostic proved the audio carries a strong PRODUK signal
(LogReg 92.78%) but NO usable JUMLAH signal (LogReg 8.33%, below random).
So jumlah is taken from the speech transcript, not the audio model.

Usage:
    from inference_wrapper_v10 import FinSenseEngine

    engine = FinSenseEngine(
        model_path='model_v10/savedmodel_v10',
        artifacts_path='model_v10/artifacts.json',
    )

    # Full pipeline: audio for produk + transcript for jumlah
    result = engine.process(
        audio_path='rec.wav',
        transcript='jual aqua enam ratus mililiter dua botol',
    )
    # → {'produk': 'aqua ...', 'jumlah': 2, 'harga': 8000, ...}

    # Or transcript-only (no audio model, parse everything from text)
    result = engine.process_transcript('jual indomie goreng tiga bungkus')
"""

from __future__ import annotations
import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional, Union

import numpy as np


# ─────────────────────────────────────────────────────────────────────
# Indonesian number parser (validated 14/14 test cases)
# ─────────────────────────────────────────────────────────────────────
_UNITS = {'nol': 0, 'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5,
          'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9}
_QTY = {'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5, 'enam': 6,
        'tujuh': 7, 'delapan': 8, 'sembilan': 9, 'sepuluh': 10}


def id2num(text: str) -> int:
    """Parse Indonesian number words to int. 'dua puluh empat ribu' -> 24000."""
    if not text or not isinstance(text, str):
        return 0
    text = text.replace('rupiah', '').strip().lower()
    words = text.split()

    def pb1000(toks):
        val = 0
        for i, w in enumerate(toks):
            if w == 'seratus':
                val += 100
            elif w == 'ratus':
                val = (val if val else 1) * 100 if val < 100 else val + 100
            elif w == 'sepuluh':
                val += 10
            elif w == 'sebelas':
                val += 11
            elif w == 'belas':
                prev = _UNITS.get(toks[i-1], 0) if i > 0 else 0
                val = val - prev + (10 + prev)
            elif w == 'puluh':
                prev = _UNITS.get(toks[i-1], 0) if i > 0 else 0
                val = val - prev + (prev * 10)
            elif w in _UNITS:
                val += _UNITS[w]
        return val

    if 'ribu' in words:
        idx = words.index('ribu')
        tp = words[:idx]
        th = 1 if not tp else pb1000(tp)
        return th * 1000 + pb1000(words[idx+1:])
    if 'seribu' in words:
        return 1000 + pb1000(words[words.index('seribu')+1:])
    return pb1000(words)


# Unit words that follow a quantity. STRONG = almost always a real qty unit.
# WEAK = also appear inside product names (coca cola satu liter, milo satu kg).
_QTY_UNITS_STRONG = {'bungkus', 'botol', 'dus', 'pcs', 'pack', 'renteng',
                     'slop', 'sak', 'biji', 'buah', 'lusin', 'pak', 'karton',
                     'box', 'kaleng', 'sachet', 'tray', 'ikat', 'lembar',
                     'batang', 'butir'}
_QTY_UNITS_WEAK = {'kilo', 'kilogram', 'kg', 'liter', 'gram', 'gr'}
_QTY_UNITS = _QTY_UNITS_STRONG | _QTY_UNITS_WEAK

# Words that can make up a number inside a catalog name: a size ("lima
# kilogram", "enam ratus dua puluh mililiter") or a brand ("dua kelinci").
_DIGIT_WORDS = set(_QTY) | set(_UNITS)
_NUM_WORDS = _DIGIT_WORDS | {'ratus', 'puluh', 'belas', 'ribu', 'juta',
                             'seratus', 'seribu', 'sebelas'}
# Size units are interchangeable when matching a name: the speaker may say
# 'kilo' (or Web Speech may write 'kg') where the catalog says 'kilogram'.
_SIZE_UNITS = _QTY_UNITS_WEAK | {'mililiter', 'ml', 'l', 'ltr'}
_PRODUK_SLOT = '<produk>'


def _same_word(heard: str, name_word: str) -> bool:
    """Whether a transcript word stands for a word of the catalog name.

    Digit words must match exactly: 'dua' heard where the name says 'lima' is
    a different number, and may well be the quantity. Other words are matched
    loosely, because the model's greedy transcript misspells them
    ('kilogam', 'pulu').
    """
    if heard == name_word:
        return True
    if heard in _DIGIT_WORDS or name_word in _DIGIT_WORDS:
        return False
    # An explicit quantity unit ('dua botol') never stands for a name word.
    if heard in _QTY_UNITS_STRONG:
        return False
    # A size unit may be heard as any spelling of any size unit ('kilu').
    targets = _SIZE_UNITS if name_word in _SIZE_UNITS else (name_word,)
    return max(SequenceMatcher(None, heard, t).ratio() for t in targets) >= 0.6


def _blank_produk_numbers(words: list, produk: str) -> list:
    """Replace the number words that belong to the product name with a slot.

    Each number run in the name ("lima" in "beras rojolele lima kilogram",
    "dua" in "dua kelinci kacang") is blanked only where the transcript also
    has the word that follows it in the name (or, for a run at the end of the
    name, the word before it). That word is what makes the number part of the
    name rather than a quantity:

        beras rojolele lima kilogram dua karung  ->  ... <produk> dua karung
        dua sprite satu liter                    ->  dua sprite <produk>
        bimoli minyak goreng dua botol           ->  unchanged ('botol' is not
                                                     'liter', so 'dua' is the qty)

    A size spoken without its unit ("gula pasir tiga") is therefore still read
    as a quantity, as before.
    """
    name = produk.lower().split()
    blank = [False] * len(words)
    i = 0
    while i < len(name):
        if name[i] not in _NUM_WORDS:
            i += 1
            continue
        j = i
        while j < len(name) and name[j] in _NUM_WORDS:
            j += 1
        run = name[i:j]
        anchor_after = j < len(name)
        anchor = name[j] if anchor_after else (name[i - 1] if i > 0 else None)
        i = j
        if anchor is None:
            continue
        for s in range(len(words)):
            # The run as words, or as one digit token ('5 kg' from Web Speech).
            if all(s + k < len(words) and _same_word(words[s + k], w)
                   for k, w in enumerate(run)):
                e = s + len(run)
            elif words[s].isdigit() and int(words[s]) == id2num(' '.join(run)):
                e = s + 1
            else:
                continue
            lo, hi = (s, e + 1) if anchor_after else (s - 1, e)
            if (0 <= lo and hi <= len(words) and not any(blank[lo:hi])
                    and _same_word(words[e if anchor_after else s - 1], anchor)):
                blank[lo:hi] = [True] * (hi - lo)
                break

    out = []
    for w, b in zip(words, blank):
        if not b:
            out.append(w)
        elif not out or out[-1] != _PRODUK_SLOT:
            out.append(_PRODUK_SLOT)
    return out


def parse_jumlah(transcript: str, produk: Optional[str] = None) -> Optional[int]:
    """Extract quantity (1-10) from transcript.

    Product names contain numbers and units (Aqua 600ml, Coca Cola 1 Liter,
    Milo 1kg), so naive 'first number' fails. When the product has already
    been decided, pass its catalog name as `produk`: the number words that
    belong to it are blanked out first (see _blank_produk_numbers), so
    "beras rojolele lima kilogram" alone yields None, not 5.

    Priority order:
      1. qty word + STRONG unit (dua botol) — most reliable
      2. digit + STRONG unit (2 botol)
      3. qty word at very end (kopi satu)
      4. LAST qty word + WEAK unit (product unit usually appears first)
      5. last qty word not followed by a number-phrase continuation
      6. fallback: standalone digit
    """
    if not transcript:
        return None
    words = transcript.lower().split()
    if produk:
        words = _blank_produk_numbers(words, produk)

    # 1. qty word + STRONG unit
    for i, w in enumerate(words):
        if w in _QTY and i + 1 < len(words) and words[i+1] in _QTY_UNITS_STRONG:
            return _QTY[w]

    # 2. digit + STRONG unit
    for i, w in enumerate(words):
        if w.isdigit() and i + 1 < len(words) and words[i+1] in _QTY_UNITS_STRONG:
            v = int(w)
            if 1 <= v <= 10:
                return v

    # 3. qty word at very end
    if words and words[-1] in _QTY:
        return _QTY[words[-1]]

    # 4. LAST qty word + WEAK unit
    #
    # A qty word directly PRECEDED by a scale word is a digit inside a larger
    # number, never a standalone quantity: in "bango kecap manis seratus
    # delapan puluh sembilan gram", the 'sembilan' before 'gram' belongs to
    # 189, and reading it as nine items multiplied the transaction ninefold.
    # Found while measuring model-only mode, where this path is reached far
    # more often because no browser transcript masks it.
    _SKALA = {'ratus', 'puluh', 'belas', 'ribu', 'juta'}
    weak_hit = None
    for i, w in enumerate(words):
        if w in _QTY and i + 1 < len(words) and words[i+1] in _QTY_UNITS_WEAK:
            if i > 0 and words[i-1] in _SKALA:
                continue
            weak_hit = _QTY[w]
    if weak_hit is not None:
        return weak_hit

    # 5. last qty word not part of a number phrase
    skip_next = {'ratus', 'ribu', 'puluh', 'belas', 'mililiter', 'ml'} | _QTY_UNITS_WEAK
    candidate = None
    for i, w in enumerate(words):
        if w in _QTY:
            nxt = words[i+1] if i + 1 < len(words) else ''
            if nxt not in skip_next:
                candidate = _QTY[w]
    if candidate is not None:
        return candidate

    # 6. fallback: standalone digit
    m = re.search(r'\b(\d{1,2})\b', ' '.join(words))
    if m:
        v = int(m.group(1))
        if 1 <= v <= 10:
            return v
    return None


DEFAULT_AUDIO_CONFIG = {
    'sample_rate': 16000, 'n_mels': 80, 'n_fft': 512,
    'win_length': 400, 'hop_length': 160, 'max_frames': 400,
}


def audio_to_logmel(audio_path, cfg=DEFAULT_AUDIO_CONFIG):
    import librosa
    y, sr = librosa.load(str(audio_path), sr=cfg['sample_rate'])
    S = librosa.feature.melspectrogram(
        y=y, sr=sr, n_mels=cfg['n_mels'], n_fft=cfg['n_fft'],
        hop_length=cfg['hop_length'], win_length=cfg['win_length'])
    S_db = librosa.power_to_db(S, ref=np.max).T
    S_db = (S_db - S_db.mean()) / (S_db.std() + 1e-8)
    T = S_db.shape[0]
    if T < cfg['max_frames']:
        S_db = np.vstack([S_db, np.zeros((cfg['max_frames']-T, cfg['n_mels']), dtype=np.float32)])
    else:
        S_db = S_db[:cfg['max_frames']]
    return S_db.astype(np.float32)


class FinSenseEngine:
    """End-to-end: produk (model) + jumlah (transcript) + harga (computed)."""

    def __init__(self, model_path=None, artifacts_path=None, audio_config=None):
        self.audio_config = audio_config or DEFAULT_AUDIO_CONFIG

        with open(artifacts_path, encoding='utf-8') as f:
            art = json.load(f)
        self.produk_vocab = art['produk_vocab']
        self.unit_price_lookup = art['unit_price_lookup']

        self.model = None
        self._infer = None
        if model_path:
            import tensorflow as tf
            self.model = tf.saved_model.load(str(model_path))
            self._infer = self.model.signatures['serving_default']
            # warm up
            dummy = np.zeros((1, self.audio_config['max_frames'],
                              self.audio_config['n_mels']), dtype=np.float32)
            self._infer(log_mel=tf.constant(dummy))
        print(f"✓ Engine ready ({len(self.produk_vocab)} produk"
              f"{', model loaded' if self.model else ', transcript-only mode'})")

    # ─── Produk from audio model ──────────────────────────────────
    def predict_produk_audio(self, audio_path):
        if self.model is None:
            raise RuntimeError("No model loaded — use process_transcript() instead")
        import tensorflow as tf
        feat = audio_to_logmel(audio_path, self.audio_config)
        out = self._infer(log_mel=tf.constant(feat[np.newaxis, ...]))
        probs = list(out.values())[0].numpy()[0]
        idx = int(np.argmax(probs))
        top3_idx = np.argsort(probs)[-3:][::-1]
        return {
            'produk': self.produk_vocab[idx],
            'conf': float(probs[idx]),
            'top3': [(self.produk_vocab[i], float(probs[i])) for i in top3_idx],
        }

    # ─── Produk from transcript (fuzzy match to vocab) ────────────
    def match_produk_transcript(self, transcript):
        """Best-effort produk match from transcript words (fallback)."""
        t = transcript.lower()
        # strip intent + qty + price words
        best, best_score = None, 0
        for p in self.produk_vocab:
            pwords = set(p.split())
            twords = set(t.split())
            overlap = len(pwords & twords)
            score = overlap / max(len(pwords), 1)
            if score > best_score:
                best, best_score = p, score
        return best, best_score

    # ─── Full pipeline: audio + transcript ────────────────────────
    def process(self, audio_path, transcript):
        """PRODUK from audio model, JUMLAH from transcript, HARGA computed."""
        produk_info = self.predict_produk_audio(audio_path)
        produk = produk_info['produk']
        jumlah = parse_jumlah(transcript) or 1
        unit_price = self.unit_price_lookup.get(produk, 0)
        harga = unit_price * jumlah
        return {
            'intent': 'jual',
            'produk': produk,
            'produk_conf': produk_info['conf'],
            'produk_top3': produk_info['top3'],
            'jumlah': jumlah,
            'unit_price': unit_price,
            'harga': harga,
            'source': {'produk': 'audio_model', 'jumlah': 'transcript'},
        }

    # ─── Transcript-only pipeline (no audio model) ────────────────
    def process_transcript(self, transcript):
        """Everything from transcript: produk (fuzzy match), jumlah, harga."""
        produk, score = self.match_produk_transcript(transcript)
        jumlah = parse_jumlah(transcript) or 1
        unit_price = self.unit_price_lookup.get(produk, 0)
        harga = unit_price * jumlah
        return {
            'intent': 'jual',
            'produk': produk,
            'produk_match_score': round(score, 2),
            'jumlah': jumlah,
            'unit_price': unit_price,
            'harga': harga,
            'source': {'produk': 'transcript_match', 'jumlah': 'transcript'},
        }


def _demo():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--artifacts', required=True)
    p.add_argument('--model', default=None)
    p.add_argument('--transcript', default='jual indomie goreng tiga bungkus')
    p.add_argument('--audio', default=None)
    args = p.parse_args()

    engine = FinSenseEngine(model_path=args.model, artifacts_path=args.artifacts)
    if args.audio and args.model:
        r = engine.process(args.audio, args.transcript)
    else:
        r = engine.process_transcript(args.transcript)
    print(json.dumps(r, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    _demo()

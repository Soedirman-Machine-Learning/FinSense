"""
FinSense — Tahap 0: decoding berbasis leksikon CTC (tanpa retraining)
=====================================================================

Bobot model TIDAK berubah sama sekali di modul ini. Yang berubah hanya cara
keluaran model dibaca, plus satu pembungkus tf.function untuk kecepatan.

1. Decoding berbasis leksikon (`LexiconRescorer`) — inti Tahap 0
   Sebelumnya: greedy decode -> string bebas -> dicocokkan ke 121 produk dengan
   heuristik `0.6*word_recall + 0.4*char_similarity`. Heuristik itu rapuh kalau
   transkrip greedy-nya berantakan, dan skornya tidak punya arti probabilistik.

   Sekarang: karena himpunan jawabannya tertutup (121 produk), setiap nama
   produk diskor langsung terhadap posteriorgram memakai CTC forward algorithm
   -> -log P(produk | audio). Ini likelihood sungguhan, bukan tebakan string,
   dan ranking-nya jauh lebih tahan terhadap transkrip yang rusak — itulah yang
   membuat ucapan sepotong ("aqua enam ratus mililiter" saja) ikut terbaca.

   Konteks (kata intent di depan, qty/harga di belakang) diambil dari transkrip
   greedy dan ditempelkan ke SEMUA kandidat, supaya setiap hipotesis
   menjelaskan seluruh audio dan panjangnya sebanding. Tanpa ini, kalimat penuh
   akan memaksa CTC menjelaskan "jual ... dua bungkus ... rupiah" sebagai bagian
   dari nama produk, dan peringkatnya rusak (uji: 97.5% -> 30.0% pada FULL).

2. Pembungkus tf.function (`build_padded_infer_fn`)
   Memanggil model Keras secara eager di CPU menjalankan GRU langkah demi
   langkah lewat Python. Membungkusnya dengan tf.function ber-signature tetap
   membuat seluruh rekurensi masuk satu graph. Diukur berpasangan dan
   berselang-seling dalam satu proses (9 ulangan, median): 1607 ms -> 53 ms,
   sekitar 30x, dengan keluaran bit-identik. Ini murni percepatan, bukan
   trade-off. Angka absolutnya tergantung beban mesin — rasionya yang stabil.

CATATAN — inferensi panjang variabel SUDAH DICOBA DAN DITOLAK.
`build_variable_length_model` di bawah membuang padding 8 detik. Secara teori
itu benar (tidak ada layer yang bergantung dimensi waktu, dan keluarannya
bit-exact pada input yang di-pad), tapi diukur pada 120 klip uji hasilnya
JUSTRU TURUN, karena model ini dilatih eksklusif pada input ter-pad 800 frame
sehingga membuang padding adalah pergeseran distribusi:

    metode                     FULL    FRAG   FRAG+SIL   SEMUA
    pad + fuzzy (lama)        92.5%   87.5%    90.0%     90.0%
    variabel + fuzzy          92.5%   72.5%    82.5%     82.5%
    variabel + rescoring CTC  97.5%   77.5%    82.5%     85.8%
    pad + rescoring CTC       97.5%   95.0%    95.0%     95.8%   <- dipakai

Fungsinya tetap disimpan karena baru jadi pilihan yang benar setelah model
dilatih ulang dengan panjang variabel + bucketing (Tahap 2). Jangan dinyalakan
sebelum itu.

Dipakai oleh serve_model.py. Tidak mengubah bentuk respons API.
"""

from __future__ import annotations

from typing import NamedTuple, Sequence

import numpy as np

from inference_wrapper_v10 import _QTY, _QTY_UNITS_STRONG

# Kata pembuka transaksi. Sama dengan _INTENT_WORDS di inference_wrapper_v11,
# ditambah varian yang muncul di data latih notebook (laku/keluar).
INTENT_WORDS = {'jual', 'beli', 'tambah', 'jualan', 'laku', 'keluar', 'pesan'}


# ─────────────────────────────────────────────────────────────────────
# 1. Pembungkus model
# ─────────────────────────────────────────────────────────────────────
def build_padded_infer_fn(model, max_frames: int, n_mels: int):
    """Bungkus model dalam tf.function ber-signature tetap.

    Bentuk masukannya persis seperti jalur lama (batch 1, max_frames, n_mels),
    jadi keluarannya bit-identik — yang hilang cuma overhead eager per langkah
    rekurensi GRU. Signature-nya tetap supaya tidak pernah ada retracing.
    """
    import tensorflow as tf

    @tf.function(input_signature=[tf.TensorSpec([1, max_frames, n_mels], tf.float32)])
    def infer(x):
        return model({'log_mel': x}, training=False)

    return infer


def logmel(samples: np.ndarray, cfg: dict, pad: bool = True) -> np.ndarray:
    """log-mel ternormalisasi, default di-pad ke cfg['max_frames'].

    Sama persis dengan audio_to_logmel() di inference_wrapper_v11, tapi bekerja
    dari array numpy (bukan path file) supaya audio dari request HTTP tidak
    perlu ditulis ke file sementara. CMVN dihitung sebelum padding, seperti di
    jalur lama.
    """
    import librosa

    S = librosa.feature.melspectrogram(
        y=samples, sr=cfg['sample_rate'], n_mels=cfg['n_mels'],
        n_fft=cfg['n_fft'], hop_length=cfg['hop_length'],
        win_length=cfg['win_length'])
    S_db = librosa.power_to_db(S, ref=np.max).T
    S_db = (S_db - S_db.mean()) / (S_db.std() + 1e-8)
    S_db = S_db.astype(np.float32)

    if not pad:
        return S_db
    T, max_frames = S_db.shape[0], cfg['max_frames']
    if T < max_frames:
        return np.vstack([S_db, np.zeros((max_frames - T, cfg['n_mels']), np.float32)])
    return S_db[:max_frames]


def build_variable_length_model(fixed_model):
    """Rangkai ulang layer model v11 di atas Input(None, n_mels).

    TIDAK DIPAKAI DI PRODUKSI — lihat catatan di docstring modul: diukur lebih
    buruk daripada jalur ter-pad karena model dilatih hanya pada input 800
    frame. Disimpan untuk dipakai setelah model dilatih ulang dengan panjang
    variabel (Tahap 2), dan untuk memverifikasi ulang klaim itu.

    Objek layer-nya dipakai ulang apa adanya (beserta bobotnya), bukan
    dideklarasikan ulang, supaya arsitekturnya tidak mungkin melenceng dari
    checkpoint.
    """
    import keras

    n_mels = fixed_model.inputs[0].shape[-1]
    inp = keras.Input(shape=(None, n_mels), name='log_mel')
    x = inp
    for layer in fixed_model.layers[1:]:
        x = layer(x)
    return keras.Model(inp, x, name='finsense_ctc_v11_varlen')


# ─────────────────────────────────────────────────────────────────────
# 2. Pemisahan konteks dari transkrip greedy
# ─────────────────────────────────────────────────────────────────────
def split_context(raw_text: str) -> tuple[str, str]:
    """Pecah transkrip greedy jadi (prefix, suffix) di sekitar span produk.

    Aturannya sama dengan extract_produk_span() lama — buang kata intent di
    depan, potong mulai dari penanda qty ("dua bungkus") — tapi di sini bagian
    yang dibuang itu dipertahankan sebagai konteks, bukan dibuang, karena
    kandidat harus tetap menjelaskan audio tersebut.

    Mengembalikan string yang sudah siap disambung: prefix diakhiri spasi dan
    suffix diawali spasi (atau string kosong).
    """
    words = raw_text.lower().split()
    lo = 1 if words and words[0] in INTENT_WORDS else 0
    hi = len(words)
    for i in range(lo, len(words)):
        if words[i] in _QTY and i + 1 < len(words) and words[i + 1] in _QTY_UNITS_STRONG:
            hi = i
            break
    prefix = ' '.join(words[:lo])
    suffix = ' '.join(words[hi:])
    return (prefix + ' ' if prefix else ''), (' ' + suffix if suffix else '')


# ─────────────────────────────────────────────────────────────────────
# 3. Rescoring leksikon berbasis CTC
# ─────────────────────────────────────────────────────────────────────
class Candidate(NamedTuple):
    produk: str
    nll: float          # -log P(hipotesis | audio), total dalam nat
    nll_per_char: float  # dinormalisasi panjang label — dipakai untuk ambang absolut
    prob: float         # posterior terkalibrasi atas 121 produk (jumlahnya 1.0)


class LexiconRescorer:
    """Skor SEMUA produk terhadap posteriorgram dengan CTC forward algorithm.

    Biayanya satu panggilan tf.nn.ctc_loss ter-batch untuk 121 kandidat di atas
    logits yang sudah terlanjur dihitung — tidak ada forward pass akustik
    tambahan.

    PENTING — label harus SparseTensor, jangan dense.
    tf.nn.ctc_loss punya dua implementasi di baliknya. Dengan label dense ia
    memakai ctc_loss_dense, yang forward algorithm-nya disusun dari while_loop
    TensorFlow dan dijalankan langkah-per-langkah di eager: pada batch 121 x
    T=330 biayanya ~2.2 detik per panggilan. Dengan label sparse ia memanggil
    kernel C++ CTCLoss: ~34 ms untuk perhitungan yang sama, selisih numerik
    ~1e-3 nat dan peringkat identik. Jadi puluhan kali lebih cepat, dan itulah
    bedanya antara fitur ini layak dipakai di API atau tidak.
    """

    # Temperatur untuk mengubah selisih log-likelihood jadi probabilitas yang
    # tidak jenuh. Tanpa ini posterior praktis selalu 1.000 (selisih antar
    # kandidat puluhan nat), sehingga tidak berguna sebagai sinyal keyakinan
    # maupun sebagai dasar deteksi ambigu. Dikalibrasi oleh eval_tahap0.py.
    TEMPERATURE = 12.0

    def __init__(self, produk_vocab: Sequence[str], char2idx: dict, blank_idx: int):
        import tensorflow as tf

        self._tf = tf
        self.produk_vocab = list(produk_vocab)
        self.char2idx = char2idx
        self.blank_idx = blank_idx

        self._encoded = [
            np.array([char2idx[c] for c in p if c in char2idx], np.int32)
            for p in self.produk_vocab
        ]
        self._produk_len = np.array(
            [max(len(e), 1) for e in self._encoded], np.float32)

    def _encode(self, text: str) -> list[int]:
        return [self.char2idx[c] for c in text if c in self.char2idx]

    @staticmethod
    def _min_frames(seq: np.ndarray) -> int:
        """Frame minimum yang dibutuhkan CTC untuk mengeluarkan seq.

        Setiap karakter butuh satu frame, dan setiap pasangan karakter kembar
        yang berdampingan butuh satu frame blank di antaranya.
        """
        if seq.size == 0:
            return 0
        return int(seq.size + np.count_nonzero(seq[1:] == seq[:-1]))

    def _hypotheses(self, pre: Sequence[int], suf: Sequence[int],
                    encoded: Sequence[np.ndarray]):
        """(daftar sekuens label, frame minimum per sekuens) untuk semua kandidat."""
        pre = np.asarray(pre, np.int32)
        suf = np.asarray(suf, np.int32)
        seqs = [np.concatenate([pre, e, suf]).astype(np.int32) for e in encoded]
        need = np.fromiter((self._min_frames(s) for s in seqs), np.int32, len(seqs))
        return seqs, need

    def _kandidat(self, tambahan: Sequence[str]):
        """(nama, encoding, panjang nama) seluruh kandidat: produk bawaan + tambahan.

        Tanpa tambahan, yang dikembalikan objek bawaan yang sama persis, sehingga
        penskorannya bit-identik dengan sebelum fitur ini ada. Nama tambahan
        diletakkan SESUDAH produk bawaan; yang sudah ada di bawaan, kembar, atau
        tidak menyisakan satu karakter pun di kosakata model dilewati.
        """
        if not tambahan:
            return self.produk_vocab, self._encoded, self._produk_len
        ada = set(self.produk_vocab)
        nama, encoded = list(self.produk_vocab), list(self._encoded)
        for t in tambahan:
            e = np.array(self._encode(t), np.int32)
            if t in ada or e.size == 0:
                continue
            ada.add(t)
            nama.append(t)
            encoded.append(e)
        panjang = np.array([max(len(e), 1) for e in encoded], np.float32)
        return nama, encoded, panjang

    def _sparse_labels(self, seqs: Sequence[np.ndarray], rows_keep: np.ndarray):
        """SparseTensor label hanya untuk baris yang layak diskor."""
        tf = self._tf
        kept = [seqs[i] for i in rows_keep]
        lengths = np.fromiter((len(s) for s in kept), np.int64, len(kept))
        values = np.concatenate(kept).astype(np.int32)
        rows = np.repeat(np.arange(len(kept), dtype=np.int64), lengths)
        cols = np.concatenate([np.arange(n, dtype=np.int64) for n in lengths])
        return tf.SparseTensor(
            indices=tf.constant(np.stack([rows, cols], axis=1)),
            values=tf.constant(values),
            dense_shape=tf.constant([len(kept), int(lengths.max())], tf.int64),
        )

    def rank(self, probs: np.ndarray, prefix: str = '', suffix: str = '',
             top_k: int = 3, tambahan: Sequence[str] = ()) -> list[Candidate]:
        """probs: (T, n_classes) keluaran softmax model. Terbaik lebih dulu.

        Kandidat yang secara fisik tidak muat di T frame (nama panjang, audio
        pendek) disaring lebih dulu: peluangnya nol, dan kernel CTCLoss akan
        melempar InvalidArgumentError kalau tetap diikutkan. Kalau tidak ada
        satu pun kandidat yang muat, hasilnya daftar kosong — pemanggil
        memperlakukannya sebagai penolakan.

        tambahan: nama produk lain (bentuk ucapan) yang ikut diskor di samping
        produk bawaan, mis. produk yang ditambahkan kasir lewat web. Kosong =
        perilaku lama tanpa perubahan apa pun.
        """
        tf = self._tf
        T = int(probs.shape[0])

        vocab, encoded, produk_len = self._kandidat(tambahan)
        seqs, need = self._hypotheses(self._encode(prefix), self._encode(suffix), encoded)
        keep = np.flatnonzero(need <= T)
        if keep.size == 0:
            return []

        # Model mengeluarkan softmax; tf.nn.ctc_loss menunggu logits dan
        # menerapkan log_softmax sendiri. log_softmax(log p) == log p untuk p
        # yang sudah ternormalisasi, jadi log-prob boleh dipakai langsung.
        logp = tf.math.log(tf.constant(probs[:, None, :], tf.float32) + 1e-9)
        logits = tf.tile(logp, [1, int(keep.size), 1])  # (T, batch, n_classes)

        scored = tf.nn.ctc_loss(
            labels=self._sparse_labels(seqs, keep), logits=logits,
            label_length=None, logit_length=tf.fill([int(keep.size)], T),
            logits_time_major=True, blank_index=self.blank_idx,
        ).numpy()

        nll = np.full(len(vocab), np.inf, np.float64)
        nll[keep] = scored

        # Konteks prefix/suffix panjangnya sama untuk semua kandidat, jadi
        # normalisasi per-karakter memakai panjang nama produknya saja.
        per_char = nll / produk_len

        shifted = -(nll - nll[keep].min()) / self.TEMPERATURE
        exp = np.exp(shifted)
        posterior = exp / exp.sum()

        order = keep[np.argsort(nll[keep])[:top_k]]
        return [
            Candidate(vocab[i], float(nll[i]),
                      float(per_char[i]), float(posterior[i]))
            for i in order
        ]

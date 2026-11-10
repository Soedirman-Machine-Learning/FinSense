"""
FinSense v12 — Produk Recognition API (CNN-BiGRU-CTC)
=====================================================

Produk ditentukan oleh model CNN-BiGRU-CTC. Alurnya:

  audio -> log-mel -> CNN-BiGRU -> per-frame char probs -> rescoring CTC
        terhadap 121 nama produk -> produk + harga

Produk TIDAK lagi ditentukan dengan mencocokkan string transkrip greedy secara
fuzzy. Karena jawabannya cuma bisa salah satu dari 121 produk, setiap nama
produk diskor langsung terhadap posteriorgram dengan CTC forward algorithm, dan
yang likelihood-nya tertinggi menang (lihat ctc_lexicon.py). Transkrip greedy
tetap dipakai, tapi hanya untuk mengambil konteks kalimat di luar nama produk
(kata intent di depan, qty/harga di belakang).

Produk yang ditambahkan kasir lewat web ikut menjadi kandidat: backend mengirim
daftar produk database di field `produk_tambahan`, dan nama yang belum ada di
121 produk bawaan diskor di sampingnya (lihat produk_tambahan.py). Tanpa field
itu jalur keputusannya persis seperti sebelumnya.

Diukur pada 120 klip uji (40 produk x 3 kondisi ucapan): jalur fuzzy lama 95.0%,
jalur yang terpasang sekarang 98.3%; pada ucapan sepotong 92.5% -> 97.5%.
Model v12 sendiri dilatih di atas korpus Tahap 1 (lihat data-science/tahap1/),
dan pada data validasinya ucapan sepotong mencapai 100% dengan CER 1.9%.

Transkrip Web Speech API dari browser TIDAK dipakai untuk menentukan produk.
Sejak diperkenalkannya saklar FINSENSE_ASR_MODE, bawaan layanan adalah
`model_only`: transkrip browser diabaikan seluruhnya, sehingga produk, jumlah,
dan harga semuanya berasal dari model CNN-BiGRU-CTC milik sistem ini. Mode
`hybrid` mengembalikan perilaku lama, dan di sanalah transkrip browser dipakai
untuk dua hal:
  1. sumber jumlah yang didahulukan (parse_jumlah) — kalau gagal, jumlah
     diambil dari transkrip model sendiri, lihat bagian 4 di predict(). Sejak
     v12 transkrip model cukup akurat untuk itu, sehingga jumlah tetap terbaca
     walau Web Speech tidak tersedia atau gagal. Sumber yang dipakai dilaporkan
     di field jumlah_source.
  2. fallback terakhir kalau audio tidak cocok dengan produk mana pun
     (produk_nll_per_char di atas MAX_NLL_PER_CHAR) — dan kalau itu terjadi,
     respons ditandai produk_source="transcript_keyword" supaya jelas hasilnya
     bukan dari model.

Semua angka akurasi yang dikembalikan dihitung, tidak ada konstanta:
  - produk_ctc_conf   : rata-rata probabilitas softmax model pada frame
                        non-blank (keyakinan model atas audio)
  - produk_conf       : posterior terkalibrasi kandidat terpilih di antara 121
                        produk (jumlah seluruh kandidat = 1.0)
  - produk_match_score: alias produk_conf, untuk kompatibilitas frontend
  - produk_nll_per_char: -log P(hipotesis|audio) per karakter nama produk.
                        Ukuran kecocokan akustik absolut; inilah yang dipakai
                        untuk menolak ucapan di luar daftar produk.

Unjuk kerja sistem (response time) juga diukur per permintaan dan ikut
dikembalikan, semuanya dalam milidetik:
  - response_time_ms   : waktu dinding di dalam layanan ini, dari body request
                         terbaca sampai respons dirakit
  - waktu_praproses_ms : dekode audio + trim + ekstraksi log-mel
  - waktu_inferensi_ms : forward pass CNN-BiGRU-CTC
  - waktu_rescoring_ms : penskoran 121 nama produk dengan CTC forward algorithm
Latensi jaringan dan hop backend Node TIDAK termasuk di sini; keduanya diukur
di lapisannya sendiri (voiceController.js dan InputPos.jsx).

Run:
  pip install fastapi uvicorn python-multipart librosa tensorflow soundfile
  uvicorn serve_model:app --host 0.0.0.0 --port 8000
"""

import io
import os
import time

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

from difflib import SequenceMatcher

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ctc_lexicon import LexiconRescorer, build_padded_infer_fn, logmel, split_context
from inference_wrapper_v10 import parse_jumlah
from inference_wrapper_v11 import (
    FinSenseEngineV11,
    ctc_greedy_decode,
    extract_produk_span,
)
from produk_tambahan import siapkan_produk_tambahan

app = FastAPI(title="FinSense Produk Model")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ─── Ambang keputusan ─────────────────────────────────────────────
# Produk sekarang diputuskan lewat rescoring CTC terhadap 121 nama produk
# (lihat ctc_lexicon.py), bukan lagi lewat fuzzy string matching. Ada dua
# besaran yang dipakai, dan keduanya punya arti yang berbeda:
#
#   produk_conf   posterior terkalibrasi atas 121 kandidat (0..1, jumlah 1.0).
#                 Menjawab "kandidat mana", BUKAN "apakah audionya memang
#                 salah satu produk" — kalau orang bicara di luar daftar,
#                 salah satu kandidat tetap menang dengan posterior tinggi.
#   nll_per_char  -log P(hipotesis|audio) dibagi panjang nama produk. Inilah
#                 ukuran kecocokan akustik absolut, dan inilah yang dipakai
#                 untuk menolak ucapan di luar daftar produk. Perhatikan:
#                 pembilangnya mencakup biaya menjelaskan konteks (kata intent,
#                 qty, harga) sedangkan penyebutnya hanya panjang nama produk,
#                 jadi skalanya tidak persis sama antara kalimat penuh dan
#                 ucapan sepotong. Ambangnya dikalibrasi atas campuran keduanya.
#
# Angka di bawah dikalibrasi oleh eval_tahap0.py terhadap himpunan uji
# (positif: 40 produk x 3 kondisi = 120 klip, negatif: 10 ucapan bukan produk).
# Simulasi keputusan atas 114 ucapan produk yang lolos ambang penolakan:
#
#   ambang   langsung benar   SALAH diterima   tanya (jawaban ada di top-3)
#    0.80         90.4%            0.0%                  9.6%
#    0.90         87.7%            0.0%                 12.3%
#    0.95         86.8%            0.0%                 13.2%
#    0.99         77.2%            0.0%                 22.8%
#
# Tidak ada satu pun kasus "sistem bertanya tapi jawabannya tidak ada di top-3",
# jadi setiap kali popup muncul, kasir pasti bisa memilih yang benar.
# Dikalibrasi ulang terhadap model v12 (eval_tahap0.py, 15 Sep 2026).
MODEL_CONFIDENT_SCORE = 0.90  # posterior >= ini: dipakai langsung tanpa bertanya.
                              # Pada v12, selisih persentil-10 kasus benar naik
                              # jadi ~42 nat (v11: ~27), sedangkan kasus salah
                              # bermedian ~9 nat — pemisahannya justru melebar.
                              # 0.80 memberi hasil identik (91.5% langsung benar,
                              # 0% salah-terima), jadi 0.90 dipertahankan sebagai
                              # margin aman tanpa biaya apa pun.
MAX_NLL_PER_CHAR = 5.7        # di atas ini audio dianggap bukan produk mana pun.
                              # Diturunkan dari 6.4 (ambang v11) karena v12 jauh
                              # lebih yakin pada ucapan yang memang produk: CER
                              # turun 21.3% -> 1.9%. Ambang lama jadi terlalu
                              # longgar untuk model ini.
                              # Pada uji: 95.8% ucapan produk lolos, 0 dari 10
                              # ucapan bukan-produk lolos. Jalur lama (ambang
                              # fuzzy 0.45) hanya meloloskan 85.0% ucapan produk
                              # pada tingkat salah-terima yang sama.
TOP_K = 3
MAX_PRODUK_TAMBAHAN = 300     # batas produk database (di luar 121 bawaan) yang
                              # ikut diskor per ucapan. Biaya rescoring naik kira-
                              # kira sebanding jumlah kandidat (121 -> ~25-35 ms).

# ─── Mode ASR ─────────────────────────────────────────────────────
# Menentukan apakah transkrip ASR pihak ketiga (Web Speech API bawaan browser)
# boleh ikut memengaruhi hasil.
#
#   model_only  transkrip browser DIABAIKAN sepenuhnya. Produk, jumlah, dan
#               harga seluruhnya dari model CNN-BiGRU-CTC milik sistem ini.
#               Inilah bawaan: sistem berjalan tanpa layanan pihak ketiga,
#               tanpa internet, dan tanpa mengirim suara pedagang ke luar.
#   hybrid      perilaku lama — transkrip browser dipakai sebagai sumber jumlah
#               yang didahulukan dan sebagai cadangan terakhir saat audio tidak
#               cocok dengan produk mana pun.
#
# Produk TIDAK PERNAH ditentukan transkrip browser pada kedua mode; ia selalu
# hasil rescoring leksikon CTC. Yang berubah hanya jumlah dan jalur cadangan.
# Disetel lewat env var, mis: FINSENSE_ASR_MODE=hybrid uvicorn serve_model:app
MODE_ASR = os.environ.get("FINSENSE_ASR_MODE", "model_only").strip().lower()
if MODE_ASR not in ("model_only", "hybrid"):
    print(f"[PERINGATAN] FINSENSE_ASR_MODE='{MODE_ASR}' tidak dikenal, "
          f"memakai 'model_only'.", flush=True)
    MODE_ASR = "model_only"

# ─── Pra-pemrosesan audio ─────────────────────────────────────────
# Perekaman browser dimulai begitu tombol mikrofon ditekan, sedangkan penutur
# biasanya diam sejenak sebelum bicara.
#
# Dulu keheningan itu berbahaya karena masukan model dipaku 8 detik: jeda di
# depan menggeser letak ucapan di dalam jendela 8 detik milik model, dan model
# ini peka terhadap posisi: pada uji internal kalimat yang sama dengan jeda 3
# detik di depan turun dari 90% ke 43%, lalu pulih ke 88% setelah keheningannya
# dipangkas. Pemangkasan ini menyelaraskan bentuk masukan dengan data latih; ia
# tidak menggantikan model maupun mengubah keputusannya.
TRIM_TOP_DB = 40              # ambang (dB di bawah puncak) yang dianggap hening.
                              # Dipilih lewat grid search atas 12 klip uji: nilai 30
                              # terlalu agresif dan memakan awalan ucapan (rekaman
                              # bersih turun 100% -> 92%), sedangkan 40 menaikkan
                              # rekaman berjeda tanpa menurunkan yang bersih.
TRIM_MIN_SECONDS = 0.2        # hasil pangkas lebih pendek dari ini diabaikan

# ─── Inisialisasi engine sekali saat startup ──────────────────────
MODEL_PATH = "model_v12/finsense_ctc_v12.keras"
CHAR_VOCAB = "model_v12/char_vocab.json"
UNIT_PRICE_LOOKUP = "model_v10/unit_price_lookup.json"

print(f"Memuat FinSense Engine dari {MODEL_PATH}…")
engine = FinSenseEngineV11(
    model_path=MODEL_PATH,
    char_vocab_path=CHAR_VOCAB,
    unit_price_path=UNIT_PRICE_LOOKUP,
)

# Model yang sama, dibungkus tf.function ber-signature tetap. Keluarannya
# bit-identik dengan engine.model; yang hilang hanya overhead eager pada
# rekurensi GRU — diukur berpasangan 1607 ms -> 53 ms per ucapan (~30x).
_infer = build_padded_infer_fn(
    engine.model, engine.audio_config['max_frames'], engine.audio_config['n_mels'])

# Rescorer leksikon: menskor 121 nama produk terhadap posteriorgram memakai CTC
# forward algorithm. Dibangun sekali; encoding labelnya di-precompute.
rescorer = LexiconRescorer(
    produk_vocab=engine.produk_vocab,
    char2idx=engine.char2idx,
    blank_idx=engine.blank_idx,
)

# Warm-up: panggilan pertama memicu trace tf.function (~1 detik), jangan sampai
# request pengguna pertama yang menanggungnya.
_infer(np.zeros((1, engine.audio_config['max_frames'],
                 engine.audio_config['n_mels']), np.float32))
print("✓ tf.function + rescoring leksikon CTC siap")
print(f"✓ Mode ASR: {MODE_ASR}" + (
    "  (transkrip browser diabaikan — sistem berjalan penuh dengan model sendiri)"
    if MODE_ASR == "model_only" else
    "  (transkrip browser dipakai untuk jumlah & jalur cadangan)"))


def _model_probs(feat: np.ndarray) -> np.ndarray:
    """Inferensi satu sample. -> (time, n_classes)"""
    return _infer(feat[np.newaxis, ...]).numpy()[0]


# Catatan: jangan menaruh warm-up di @app.on_event("startup"). App ini di-mount
# sebagai sub-aplikasi oleh combined_ai.py, dan Starlette tidak menjalankan event
# lifespan untuk sub-app yang di-mount, sehingga hook seperti itu tidak pernah
# terpanggil. Warm-up yang benar-benar berjalan ada di konstruktor
# FinSenseEngineV11, yang melakukan satu inferensi dummy saat model dimuat.


def _decode_audio_bytes_fast(audio_bytes, cfg):
    """Baca audio webm/wav/ogg langsung dari memory bytes, tanpa file temporary."""
    import librosa

    data, sample_rate = sf.read(io.BytesIO(audio_bytes))

    # Stereo -> mono
    samples = np.mean(data, axis=1) if data.ndim > 1 else data

    if sample_rate != cfg['sample_rate']:
        samples = librosa.resample(
            y=samples, orig_sr=sample_rate, target_sr=cfg['sample_rate']
        )

    samples = samples.astype(np.float32)

    # Buang keheningan di awal dan akhir sebelum ekstraksi fitur. Bila hasilnya
    # terlalu pendek (mis. rekaman memang senyap), pakai sinyal asli supaya
    # jalur penolakan tetap bekerja sebagaimana mestinya.
    if samples.size:
        trimmed, _ = librosa.effects.trim(samples, top_db=TRIM_TOP_DB)
        if trimmed.size >= int(TRIM_MIN_SECONDS * cfg['sample_rate']):
            samples = trimmed

    # log-mel + pad ke cfg['max_frames'], sama seperti audio_to_logmel().
    return logmel(samples, cfg)


def ctc_confidence(probs: np.ndarray, blank_idx: int) -> float:
    """Keyakinan model: rata-rata probabilitas argmax pada frame non-blank.

    Layer output model bernama 'ctc_softmax', jadi probs sudah ternormalisasi
    dan nilainya bisa dipakai langsung sebagai probabilitas.
    """
    ids = np.argmax(probs, axis=-1)
    mask = ids != blank_idx
    if not mask.any():
        return 0.0
    return float(np.max(probs, axis=-1)[mask].mean())


def keyword_fallback(transcript: str, produk_vocab: list):
    """Fallback: cari produk dari transkrip browser saat model gagal.

    Kandidat difilter dengan keyword containment, lalu diberi skor memakai
    formula fuzzy yang sama agar angka yang dilaporkan tetap hasil hitungan.
    """
    stop_words = {
        'jual', 'beli', 'pesan', 'tambah',
        'satu', 'dua', 'tiga', 'empat', 'lima',
        'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
        'bungkus', 'botol', 'dus', 'pcs', 'pack',
    }
    text = transcript.lower().strip()
    query_words = [w for w in text.split() if w not in stop_words and not w.isdigit()]
    if not query_words:
        return []

    candidates = [p for p in produk_vocab if all(w in p for w in query_words)]
    if not candidates:
        return []

    span = extract_produk_span(text)
    twords = set(span.split())
    scored = []
    for p in candidates:
        pwords = p.split()
        recall = len(set(pwords) & twords) / max(len(pwords), 1)
        char_sim = SequenceMatcher(None, span, p).ratio()
        scored.append((p, 0.6 * recall + 0.4 * char_sim))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:TOP_K]


def _reject(message: str, ctc_conf: float, raw_text: str, score: float = 0.0,
            nll_per_char: float = float('inf'), waktu: dict | None = None):
    return {
        "success": False,
        **(waktu or {}),
        "message": message,
        "produk": "Tidak dikenali",
        "produk_raw_text": raw_text,
        "produk_conf": float(score),
        "produk_match_score": float(score),
        "produk_ctc_conf": float(ctc_conf),
        "produk_nll_per_char": float(nll_per_char),
        "produk_source": "rejected",
        "ambiguity_reason": None,
        "produk_top3": [],
        "matchedProduct": None,
        "jumlah": 0,
        "jumlah_source": "rejected",
        "unit_price": 0,
        "harga": 0,
        "usedFallback": False,
    }


def putuskan_transaksi(probs, raw_text, ctc_conf, transcript="", jumlah_form=0,
                       mode=None, produk_tambahan=None):
    """Seluruh keputusan layanan atas satu ucapan -> dict hasil (tanpa rincian waktu).

    Dipisahkan dari endpoint HTTP dengan sengaja: skrip evaluasi
    (eval_mode_asr.py) memanggil fungsi yang SAMA, sehingga angka yang
    dilaporkan di skripsi benar-benar berasal dari jalur keputusan yang
    dilayankan, bukan dari salinan yang bisa menyimpang diam-diam.

    mode='model_only' membuang transkrip pihak ketiga sebelum dipakai; produk
    tetap ditentukan rescoring leksikon CTC pada kedua mode.

    produk_tambahan: {bentuk ucapan: ProdukTambahan} dari siapkan_produk_tambahan(),
    yaitu produk database web di luar 121 produk bawaan. Ikut diskor sebagai
    kandidat; bila terpilih, nama asli dan harga database-lah yang dikembalikan.
    Kosong/None (bawaan, dan yang dipakai skrip evaluasi) = perilaku lama.
    """
    mode = (mode or MODE_ASR)
    tambahan = produk_tambahan or {}
    # Satu titik penyaringan: sesudah baris ini, tidak ada lagi bagian yang
    # perlu tahu mode apa yang sedang berlaku.
    transcript_efektif = transcript if mode == "hybrid" else ""

    # Produk diputuskan lewat rescoring CTC terhadap 121 nama produk. Konteks di
    # luar nama produk (kata intent, qty, harga) diambil dari transkrip greedy
    # MILIK MODEL — bukan dari browser — dan ditempelkan ke semua kandidat,
    # supaya tiap hipotesis menjelaskan seluruh audio dan panjangnya sebanding.
    t_awal_rescoring = time.perf_counter()
    prefix, suffix = split_context(raw_text)
    ranked = rescorer.rank(probs, prefix, suffix, top_k=TOP_K, tambahan=list(tambahan))
    ms_rescoring = round((time.perf_counter() - t_awal_rescoring) * 1000, 1)

    produk_source = "audio_model_ctc"
    used_fallback = False
    ambiguity_reason = None
    nll_per_char = ranked[0].nll_per_char if ranked else float('inf')

    if ranked and nll_per_char <= MAX_NLL_PER_CHAR:
        if ranked[0].prob >= MODEL_CONFIDENT_SCORE:
            # Unggul jauh dari kandidat kedua: langsung pakai, jangan ganggu kasir.
            candidates = [(ranked[0].produk, ranked[0].prob)]
        else:
            # Kandidat teratas tidak unggul meyakinkan -> biarkan user memilih.
            # (produk_vocab memuat beberapa nama yang hampir kembar, mis.
            #  "abc kecap asin …" vs "kecap asin …".)
            candidates = [(c.produk, c.prob) for c in ranked]
            ambiguity_reason = "skor_berdekatan"
    else:
        # ── 3. Audio tidak cocok dengan produk mana pun -> jalur cadangan ──
        #
        # Sumber teksnya berbeda menurut mode, dan perbedaan ini yang menentukan
        # apakah "model_only" berarti sistem berdiri sendiri atau sekadar
        # kehilangan pengamannya:
        #   hybrid      transkrip browser (ASR pihak ketiga)
        #   model_only  transkrip greedy MODEL SENDIRI. Jalur cadangan tidak
        #               dihapus, hanya diberi sumber yang tidak bergantung pihak
        #               ketiga. Diukur pada 144 ucapan: dari 14 ucapan yang
        #               ditolak model_only sementara hybrid menerimanya, 11 di
        #               antaranya nama produknya UTUH di transkrip model sendiri
        #               — penolakan itu murni karena sumber teksnya salah pilih,
        #               bukan karena modelnya tidak mendengar.
        teks_cadangan = transcript_efektif if mode == "hybrid" else raw_text
        katalog = engine.produk_vocab + list(tambahan) if tambahan else engine.produk_vocab
        candidates = keyword_fallback(teks_cadangan, katalog)
        if not candidates:
            print(
                f"[REJECTED] Audio tidak cocok dengan produk mana pun: "
                f"nll/char={nll_per_char:.2f} > {MAX_NLL_PER_CHAR}",
                flush=True,
            )
            return _reject(
                "Suara tidak dikenali oleh model, silakan ulangi perintah.",
                ctc_conf, raw_text,
                ranked[0].prob if ranked else 0.0, nll_per_char,
                waktu={"asr_mode": mode, "waktu_rescoring_ms": ms_rescoring},
            )
        produk_source = ("transcript_keyword" if mode == "hybrid"
                         else "model_text_keyword")
        used_fallback = True
        if len(candidates) > 1:
            ambiguity_reason = "banyak_kandidat_transkrip"
        print(
            f"[FALLBACK] nll/char={nll_per_char:.2f} > {MAX_NLL_PER_CHAR}, "
            f"memakai {'transkrip browser' if mode == 'hybrid' else 'transkrip model sendiri'}. "
            f"Kandidat: {[c[0] for c in candidates]}",
            flush=True,
        )

    # Nama yang keluar ke backend adalah nama asli database untuk produk
    # tambahan (backend dan popup frontend mencocokkannya persis), sedangkan
    # `produk` tetap bentuk ucapannya karena parse_jumlah dan harga memakainya.
    def _nama_asli(p):
        return tambahan[p].nama if p in tambahan else p

    top3 = [[_nama_asli(p), round(s, 2)] for p, s in candidates]
    is_ambiguous = len(top3) > 1
    produk = candidates[0][0]
    match_score = top3[0][1]

    # ── 4. Jumlah, harga dari lookup ──────────────────────────────
    # Urutan sumber jumlah, dari yang paling berwenang:
    #
    #   1. field `jumlah`  — kasir menyetelnya sendiri di UI, selalu menang.
    #   2. transkrip Web Speech — ASR umum dengan kosakata penuh.
    #   3. transkrip model sendiri — BARU sejak v12.
    #
    # Nomor 3 dulu tidak ada karena model belum cukup andal mengeja angka.
    # Pada v12 CER turun ke 1.9%, dan transkrip mentahnya menuliskan "dua
    # bungkus" / "tiga bungkus" dengan benar. Menjadikannya cadangan berarti
    # jumlah tetap terbaca walau Web Speech gagal, tidak tersedia di browser
    # itu, atau si kasir bicara di luar jangkauan pengenalannya.
    #
    # Web Speech tetap didahulukan supaya perilaku yang sudah terbukti tidak
    # berubah; model hanya mengisi kekosongan.
    #
    # Nama produk yang sudah diputuskan ikut diberikan ke parser, supaya angka
    # di dalam nama itu sendiri tidak terbaca sebagai jumlah: tanpanya, ucapan
    # "beras rojolele lima kilogram" saja tercatat 5 karung (harga 5x lipat).
    # Saat ambigu, yang dipakai kandidat teratas; kandidat yang berdekatan
    # umumnya nama kembar dengan ukuran yang sama.
    qty_source = "form"
    qty = jumlah_form if jumlah_form and jumlah_form > 0 else 0
    if not qty:
        qty = parse_jumlah(transcript_efektif, produk) or 0
        qty_source = "transcript_browser"
    if not qty:
        qty = parse_jumlah(raw_text, produk) or 0
        qty_source = "audio_model_ctc"
    if not qty:
        qty, qty_source = 1, "default"

    if produk in tambahan:
        unit_price = tambahan[produk].harga
    else:
        unit_price = engine.unit_price_lookup.get(produk, 0)
    harga = unit_price * qty

    # Saat ambigu, matchedProduct dikosongkan agar frontend menampilkan popup pilihan
    nama_produk = _nama_asli(produk)
    final_matched_product = (
        None if is_ambiguous else {"id": nama_produk, "name": nama_produk, "price": unit_price}
    )
    heard = extract_produk_span(raw_text) or raw_text or transcript_efektif
    produk_tampil = f"Pilihan untuk: {heard}" if is_ambiguous else nama_produk

    # Log keputusan. Rincian waktu dicetak pemanggilnya: fungsi ini tidak
    # mengetahui waktu praproses maupun inferensi, dan tidak boleh berpura-pura
    # tahu — skrip evaluasi memanggilnya berkali-kali atas probs yang sama.
    print(
        f"[SUCCESS] mode={mode} | Result: '{produk_tampil}' | Qty: {qty} ({qty_source}) | "
        f"Conf: {match_score * 100:.1f}% | nll/char: {nll_per_char:.2f} | "
        f"CTC: {ctc_conf * 100:.1f}% | Source: {produk_source} | "
        f"rescoring {ms_rescoring:.0f} ms",
        flush=True,
    )

    return {
        "success": True,
        "intent": "jual",
        "produk": produk_tampil,
        "produk_raw_text": raw_text,
        "produk_conf": float(match_score),
        "produk_match_score": float(match_score),
        "produk_ctc_conf": float(ctc_conf),
        "produk_nll_per_char": float(nll_per_char),
        "produk_source": produk_source,
        "ambiguity_reason": ambiguity_reason if is_ambiguous else None,
        "produk_top3": top3,
        "matchedProduct": final_matched_product,
        "jumlah": qty,
        "jumlah_source": qty_source,
        "unit_price": unit_price,
        "harga": harga,
        "usedFallback": used_fallback,
        "asr_mode": mode,
        "waktu_rescoring_ms": ms_rescoring,
    }


@app.post("/")
async def predict(
    audio: UploadFile = File(...),
    transcript: str = Form(""),
    jumlah: int = Form(0),
    produk_tambahan: str = Form(""),
):
    # Stopwatch dimulai sebelum body dibaca supaya angkanya mencakup seluruh
    # pekerjaan layanan atas permintaan ini, bukan hanya bagian modelnya.
    # Dipakai untuk metrik unjuk kerja sistem (response time) pada skripsi dan
    # ditampilkan ke kasir di popup hasil.
    t_mulai = time.perf_counter()
    audio_bytes = await audio.read()

    # ── 1. Audio -> fitur -> model CNN-BiGRU-CTC ──────────────────
    t0 = time.perf_counter()
    feat = _decode_audio_bytes_fast(audio_bytes, engine.audio_config)
    t_praproses = time.perf_counter()
    probs = _model_probs(feat)
    t_inferensi = time.perf_counter()
    raw_text = ctc_greedy_decode(probs, engine.idx2char, engine.blank_idx)
    ctc_conf = ctc_confidence(probs, engine.blank_idx)

    print(
        f"\n[SPEECH DETECTED] mode={MODE_ASR} | Web Speech: "
        f"{repr(transcript) if MODE_ASR == 'hybrid' else 'DIABAIKAN'} | "
        f"AI Raw CTC Text: '{raw_text}' | CTC conf: {ctc_conf * 100:.1f}%",
        flush=True,
    )

    def _waktu() -> dict:
        """Rincian waktu layanan (ms). Dihitung, bukan konstanta.

        response_time_ms = waktu dinding di dalam layanan AI, dari body request
        terbaca sampai respons dirakit. Latensi jaringan dan hop backend Node
        tidak termasuk — keduanya diukur di lapisannya masing-masing.
        """
        return {
            "response_time_ms": round((time.perf_counter() - t_mulai) * 1000, 1),
            "waktu_praproses_ms": round((t_praproses - t0) * 1000, 1),
            "waktu_inferensi_ms": round((t_inferensi - t_praproses) * 1000, 1),
            # waktu_rescoring_ms datang dari putuskan_transaksi(), tempat
            # penskoran leksikon sesungguhnya dijalankan.
        }

    # Produk database web yang belum ada di 121 produk bawaan (lihat
    # produk_tambahan.py). Backend lama yang tidak mengirim field ini tetap
    # dilayani dengan 121 produk bawaan saja.
    tambahan = siapkan_produk_tambahan(produk_tambahan, engine.produk_vocab,
                                       MAX_PRODUK_TAMBAHAN)
    if tambahan:
        print(f"[PRODUK TAMBAHAN] {len(tambahan)} produk database ikut diskor",
              flush=True)

    hasil = putuskan_transaksi(probs, raw_text, ctc_conf, transcript,
                               jumlah_form=jumlah, produk_tambahan=tambahan)
    waktu = _waktu()
    print(
        f"[WAKTU] total {waktu['response_time_ms']:.0f} ms "
        f"(praproses {waktu['waktu_praproses_ms']:.0f} / "
        f"inferensi {waktu['waktu_inferensi_ms']:.0f} / "
        f"rescoring {hasil.get('waktu_rescoring_ms', 0):.0f})",
        flush=True,
    )
    return {**waktu, **hasil}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "n_produk": len(engine.produk_vocab),
        "maks_produk_tambahan": MAX_PRODUK_TAMBAHAN,
        "asr_mode": MODE_ASR,
        "model": MODEL_PATH,
        "decoder": "ctc_lexicon_rescoring",
        "thresholds": {
            "model_confident_score": MODEL_CONFIDENT_SCORE,
            "max_nll_per_char": MAX_NLL_PER_CHAR,
            "posterior_temperature": LexiconRescorer.TEMPERATURE,
        },
        "preprocessing": {
            "trim_top_db": TRIM_TOP_DB,
            "trim_min_seconds": TRIM_MIN_SECONDS,
        },
    }

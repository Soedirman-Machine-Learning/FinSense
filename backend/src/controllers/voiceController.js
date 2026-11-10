const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const prisma = require('../config/prisma');

// Helper: normalisasi string (aman untuk input non-string)
const normalize = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();

/**
 * Mencari produk di database berdasarkan nama prediksi dan alternatif top3
 * @param {string} predictedName - Nama produk hasil prediksi model
 * @param {Array} top3Alternatives - Alternatif top3 dari model (opsional)
 * @returns {Promise<Object|null>} Produk yang cocok atau null
 */
async function findProductByPrediction(predictedName, top3Alternatives = []) {
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, price: true },
  });
  if (!allProducts.length) return null;

  const normalizedPredicted = normalize(predictedName);
  const normalizedAlternatives = (top3Alternatives || []).map((alt) =>
    normalize(alt),
  );

  // 1. Coba kecocokan persis (exact match)
  for (const prod of allProducts) {
    const normalizedProd = normalize(prod.name);
    if (normalizedProd === normalizedPredicted) return prod;
    if (normalizedAlternatives.includes(normalizedProd)) return prod;
  }

  // 2. Fallback: partial match berdasarkan kata (overlap)
  const predictedWords = new Set(normalizedPredicted.split(/\s+/));
  let bestMatch = null;
  let bestOverlap = 0;
  for (const prod of allProducts) {
    const prodNorm = normalize(prod.name);
    const prodWords = new Set(prodNorm.split(/\s+/));
    const overlap = [...predictedWords].filter((w) => prodWords.has(w)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = prod;
    }
  }
  return bestOverlap >= 1 ? bestMatch : null;
}

/**
 * Mencari produk dari transkrip (fallback saat confidence rendah atau produk tidak ditemukan)
 * @param {string} transcript - Teks transkrip
 * @returns {Promise<Object|null>} Produk yang cocok atau null
 */
async function findProductFromTranscript(transcript) {
  // Transkrip kosong adalah keadaan NORMAL, bukan kegagalan: pada mode
  // model-only frontend sengaja tidak mengirim transkrip browser, sehingga
  // jalur cadangan ini memang tidak boleh aktif.
  if (!transcript) return null;

  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, price: true },
  });
  if (!allProducts.length) return null;

  const transNorm = normalize(transcript);
  const transWords = new Set(transNorm.split(/\s+/));

  let bestMatch = null;
  let bestOverlap = 0;
  for (const prod of allProducts) {
    const prodNorm = normalize(prod.name);
    const prodWords = new Set(prodNorm.split(/\s+/));
    const overlap = [...transWords].filter((w) => prodWords.has(w)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = prod;
    }
  }
  return bestOverlap >= 1 ? bestMatch : null;
}

/**
 * Daftar produk database untuk layanan AI, supaya produk yang ditambahkan lewat
 * web ikut menjadi kandidat rescoring tanpa melatih ulang model. Cakupannya sama
 * dengan pencocokan produk di atas (seluruh produk, karena rute suara belum
 * memakai login). Layanan AI sendiri yang membuang nama yang sudah ada di 121
 * produk bawaannya. Gagal membaca database tidak boleh menggagalkan pencatatan
 * suara, jadi hasilnya cukup daftar kosong (= 121 produk bawaan saja).
 * @returns {Promise<Array<{name: string, price: number}>>}
 */
async function daftarProdukUntukAi() {
  try {
    const produk = await prisma.product.findMany({
      select: { name: true, price: true },
    });
    return produk.map((p) => ({ name: p.name, price: p.price ?? 0 }));
  } catch (err) {
    console.error('[Voice] Gagal membaca produk untuk layanan AI:', err.message);
    return [];
  }
}

exports.processVoice = async (req, res) => {
  let audioFilePath = null;
  // Stopwatch metrik unjuk kerja sistem (lihat BAB evaluasi: response time).
  // Tiga lapisan diukur terpisah supaya jelas waktu itu habis di mana:
  //   response_time_ms         — di dalam layanan AI (dikirim FastAPI)
  //   ai_roundtrip_ms          — backend -> layanan AI -> backend (termasuk
  //                              unggah berkas audio antar-proses)
  //   backend_response_time_ms — seluruh handler ini, termasuk query produk
  // Latensi browser<->backend diukur di sisi frontend (InputPos.jsx).
  const tMulaiHandler = process.hrtime.bigint();
  const msSejak = (t) => Number(process.hrtime.bigint() - t) / 1e6;

  try {
    const audioFile = req.file;
    const transcript = req.body.transcript || '';
    let jumlah = parseInt(req.body.jumlah) || 0;

    if (!audioFile) {
      return res
        .status(400)
        .json({ success: false, message: 'No audio file uploaded' });
    }

    audioFilePath = audioFile.path;

    // Siapkan FormData untuk FastAPI
    const form = new FormData();
    form.append('audio', fs.createReadStream(audioFilePath), {
      filename: audioFile.originalname || 'recording.webm',
      contentType: audioFile.mimetype,
    });
    form.append('transcript', transcript);
    if (jumlah > 0) form.append('jumlah', String(jumlah));
    const produkDb = await daftarProdukUntukAi();
    if (produkDb.length) form.append('produk_tambahan', JSON.stringify(produkDb));

    // Garis miring di akhir itu WAJIB. Endpoint voice adalah sub-aplikasi yang
    // di-mount, sehingga POST ke '/voice' dibalas 307 redirect ke '/voice/'.
    // Axios mengikuti redirect itu dengan body berupa stream yang sudah habis
    // terbaca, jadi bagian 'audio' hilang dan FastAPI membalas 422 — dan karena
    // bergantung pada waktu, kegagalannya muncul sesekali saja.
    const rawUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000/voice/';
    const fastApiUrl = rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;
    console.log(`[Voice] Calling FastAPI: ${fastApiUrl}`);

    const tMulaiAi = process.hrtime.bigint();
    const fastApiResponse = await axios.post(fastApiUrl, form, {
      headers: { ...form.getHeaders() },
      timeout: 60000,
      // Jangan pernah mengikuti redirect: body stream tidak bisa diulang, dan
      // mengikutinya menghasilkan permintaan rusak yang sulit dilacak. Lebih
      // baik gagal terang-terangan.
      maxRedirects: 0,
    });
    const aiRoundtripMs = Number(msSejak(tMulaiAi).toFixed(1));

    // Hapus file temporary
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }

    // Data dari FastAPI (dengan nilai default aman)
    const {
      success: aiSuccess = true,
      message: aiMessage = null,
      produk = '',
      produk_raw_text = '',
      produk_conf = 0,
      produk_match_score = null,
      produk_ctc_conf = null,
      produk_source = null,
      ambiguity_reason = null,
      produk_top3 = [],
      jumlah: qty,
      jumlah_source = null,
      unit_price = 0,
      harga: hargaTotal,
      response_time_ms: aiResponseTimeMs = null,
      waktu_praproses_ms: aiPraprosesMs = null,
      waktu_inferensi_ms: aiInferensiMs = null,
      waktu_rescoring_ms: aiRescoringMs = null,
    } = fastApiResponse.data;

    // Layanan AI sudah menolak hasilnya. Teruskan apa adanya; menambal dengan
    // transkrip di sini hanya akan menyembunyikan kegagalan model.
    if (!aiSuccess) {
      console.log('[Voice] Ditolak layanan AI:', aiMessage);
      return res.json({
        success: false,
        message: aiMessage || 'Suara tidak dikenali, silakan ulangi.',
        produk,
        produk_raw_text,
        produk_conf,
        produk_match_score,
        produk_ctc_conf,
        produk_source,
        ambiguity_reason: null,
        produk_top3: [],
        jumlah: 0,
        harga: 0,
        matchedProduct: null,
        usedFallback: false,
        response_time_ms: aiResponseTimeMs,
        waktu_praproses_ms: aiPraprosesMs,
        waktu_inferensi_ms: aiInferensiMs,
        waktu_rescoring_ms: aiRescoringMs,
        ai_roundtrip_ms: aiRoundtripMs,
        backend_response_time_ms: Number(msSejak(tMulaiHandler).toFixed(1)),
      });
    }

    // produk_top3 berisi pasangan [nama, skor]; pencocokan hanya butuh namanya.
    const top3Names = (produk_top3 || []).map((item) =>
      Array.isArray(item) ? item[0] : item,
    );
    const isAmbiguous = top3Names.length > 1;

    const finalJumlah = qty || jumlah || 1;
    const finalHarga = hargaTotal || unit_price * finalJumlah;

    // Saat hasil ambigu, matchedProduct sengaja dibiarkan null agar antarmuka
    // menampilkan dialog pemilihan, bukan langsung menambahkan satu produk.
    let matchedProduct = isAmbiguous
      ? null
      : await findProductByPrediction(produk, top3Names);
    let usedFallback = produk_source === 'transcript_keyword';
    let finalProductName = produk;

    // Fallback transkrip dipakai hanya bila hasil model tidak menemukan padanan
    // di database, bukan berdasarkan ambang skor. Kelayakan skor model sudah
    // dinilai di layanan AI, jadi menilainya ulang di sini akan menimpa model.
    if (!isAmbiguous && !matchedProduct) {
      const fallbackProduct = await findProductFromTranscript(transcript);
      if (fallbackProduct) {
        finalProductName = fallbackProduct.name;
        matchedProduct = fallbackProduct;
        usedFallback = true;
        console.log(
          `[Voice] Produk model tidak ada di database, memakai transkrip → ${finalProductName}`,
        );
      }
    }

    // Kirim response
    res.json({
      success: true,
      produk: finalProductName,
      produk_raw_text,
      produk_conf,
      produk_match_score,
      produk_ctc_conf,
      produk_source,
      ambiguity_reason,
      produk_top3,
      jumlah: finalJumlah,
      // Dari mana angka jumlah itu berasal: form / transcript_browser /
      // audio_model_ctc / default. Diteruskan apa adanya supaya saat menelusuri
      // jumlah yang salah, jelas siapa yang menentukannya.
      jumlah_source,
      harga: finalHarga,
      matchedProduct: matchedProduct
        ? {
            id: matchedProduct.id,
            name: matchedProduct.name,
            price: matchedProduct.price,
          }
        : null,
      usedFallback,
      // Rincian waktu, semuanya dalam milidetik dan semuanya hasil pengukuran.
      response_time_ms: aiResponseTimeMs,
      waktu_praproses_ms: aiPraprosesMs,
      waktu_inferensi_ms: aiInferensiMs,
      waktu_rescoring_ms: aiRescoringMs,
      ai_roundtrip_ms: aiRoundtripMs,
      backend_response_time_ms: Number(msSejak(tMulaiHandler).toFixed(1)),
    });

    console.log('[Voice] Processed successfully:', {
      produk: finalProductName,
      sumber: produk_source,
      transkripModel: produk_raw_text,
      jumlah: finalJumlah,
      jumlah_source,
      harga: finalHarga,
      matchedProduct: matchedProduct ? matchedProduct.name : 'No match',
      ambigu: isAmbiguous,
      usedFallback,
      waktuLayananAiMs: aiResponseTimeMs,
      waktuPulangPergiAiMs: aiRoundtripMs,
      waktuHandlerMs: Number(msSejak(tMulaiHandler).toFixed(1)),
    });
  } catch (error) {
    console.error('[Voice] Error:', error.message);
    if (error.response) {
      console.error('[Voice] FastAPI response error:', error.response.data);
    }

    // Hapus file temporary jika masih ada
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      try {
        fs.unlinkSync(audioFilePath);
      } catch (e) {}
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process voice',
      detail: error.message,
    });
  }
};

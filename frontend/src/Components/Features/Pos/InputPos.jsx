import React, { useState, useEffect, useRef } from 'react';
import { getProducts } from '../../../services/productService';
import { useCart } from '../../../hooks/useCart';
import { FaMicrophone, FaSearch, FaSyncAlt } from 'react-icons/fa';
import Swal from 'sweetalert2';
import api from '../../../services/api';
import { convertToWav } from '../../../utils/audioUtils';

const QTY = {
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
};
const STRONG_UNITS = new Set([
  'bungkus',
  'botol',
  'dus',
  'pcs',
  'pack',
  'renteng',
  'slop',
  'sak',
  'biji',
  'buah',
  'lusin',
  'pak',
  'karton',
  'box',
  'kaleng',
  'sachet',
  'tray',
  'ikat',
  'lembar',
  'batang',
  'butir',
]);
const WEAK_UNITS = new Set(['kilo', 'kilogram', 'kg', 'liter', 'gram', 'gr']);

// Satuan UKURAN kemasan. Angka yang diikuti salah satu kata ini menerangkan
// isi produk ("aqua 600 ml"), bukan banyaknya barang yang dibeli.
const MEASURE_UNITS = new Set([
  'ml', 'mililiter', 'militer', 'cc',
  'l', 'liter', 'ltr',
  'g', 'gr', 'gram', 'kg', 'kilo', 'kilogram',
]);

// Kata pengali bilangan. Angka yang diikutinya adalah bagian dari nominal
// harga ("dua ribu"), bukan jumlah barang.
const SCALE_WORDS = new Set(['ribu', 'rb', 'ratus', 'juta', 'puluh', 'belas']);

// Angka telanjang tanpa satuan hitung di atas nilai ini hampir pasti ukuran
// kemasan atau harga, bukan jumlah barang yang dibeli di warung.
const MAX_BARE_QTY = 99;

function parseJumlah(transcript) {
  if (!transcript) return null;
  const words = transcript
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  // Angka yang diikuti satuan ukuran atau kata pengali bukan jumlah barang.
  const bagianUkuranAtauHarga = (i) => {
    const next = words[i + 1] || '';
    return MEASURE_UNITS.has(next) || SCALE_WORDS.has(next);
  };

  // 1. Angka + satuan hitung ("3 bungkus") — paling meyakinkan, tanpa batas nilai.
  for (let i = 0; i < words.length; i++) {
    if (/^\d+$/.test(words[i]) && STRONG_UNITS.has(words[i + 1] || '')) {
      return parseInt(words[i]);
    }
  }

  // 2. Kata-angka + satuan hitung ("tiga bungkus").
  for (let i = 0; i < words.length; i++) {
    if (QTY[words[i]] && STRONG_UNITS.has(words[i + 1] || '')) {
      return QTY[words[i]];
    }
  }

  // 3. Angka telanjang ("indomie goreng 3"), asal bukan ukuran/harga dan masuk akal.
  for (let i = 0; i < words.length; i++) {
    if (/^\d+$/.test(words[i]) && !bagianUkuranAtauHarga(i)) {
      const v = parseInt(words[i]);
      if (v >= 1 && v <= MAX_BARE_QTY) return v;
    }
  }

  // 4. Kata-angka telanjang ("indomie tiga").
  for (let i = 0; i < words.length; i++) {
    if (QTY[words[i]] && !bagianUkuranAtauHarga(i)) return QTY[words[i]];
  }

  return null;
}

// Ringkasan waktu respons untuk ditampilkan di popup hasil.
//
// Dua angka, dan keduanya hasil pengukuran — tidak ada yang dikira-kira:
//   total  — stopwatch di browser, dari permintaan dikirim sampai respons
//            diterima. Inilah yang benar-benar dirasakan kasir.
//   model  — waktu di dalam layanan AI (response_time_ms dari FastAPI).
//            Selisih total-model adalah jaringan + backend Node.
// Kalau layanan tidak mengirim rinciannya (mis. versi lama), hanya total yang
// ditampilkan; jangan pernah menampilkan angka yang tidak diukur.
function formatWaktuRespons(totalMs, data = {}) {
  const ms = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} detik` : `${Math.round(v)} ms`);
  const model = data.response_time_ms;
  const rincian =
    typeof model === 'number' && Number.isFinite(model)
      ? ` (model ${ms(model)})`
      : '';
  return `Waktu respons: ${ms(totalMs)}${rincian}`;
}

// ── Saklar ASR pihak ketiga (Web Speech API bawaan browser) ──────────────
//
// Bawaan: MATI. Produk, jumlah, dan harga seluruhnya ditentukan model
// CNN-BiGRU-CTC milik sistem ini, sehingga pencatatan tetap berjalan tanpa
// layanan pihak ketiga, tanpa internet, dan tanpa mengirim suara pedagang ke
// server luar. Web Speech juga hanya tersedia di Chrome.
//
// Hidupkan dengan VITE_PAKAI_WEB_SPEECH=true untuk membandingkan kedua mode;
// layanan AI punya saklar padanannya (FINSENSE_ASR_MODE=hybrid) dan keduanya
// harus disetel bersama agar hasilnya bermakna.
const PAKAI_WEB_SPEECH = import.meta.env.VITE_PAKAI_WEB_SPEECH === 'true';

// Batas lama merekam pada mode model-only. Disamakan dengan jendela masukan
// model (8 detik): audio yang lebih panjang akan dipotong model, jadi merekam
// lebih lama hanya menambah waktu unggah tanpa menambah informasi.
const MAKS_REKAM_MS = 8000;

function InputPos() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const batasRekamRef = useRef(null);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await getProducts();
        setProducts(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (query.length > 1) {
      setFiltered(
        products.filter((p) =>
          p.name.toLowerCase().includes(query.toLowerCase()),
        ),
      );
    } else {
      setFiltered([]);
    }
  }, [query, products]);

  const handleAddProduct = (product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price || 0,
      qty: 1,
    });
    Swal.fire({
      icon: 'success',
      title: 'Berhasil',
      text: `${product.name} ditambahkan ke keranjang`,
      timer: 1500,
      showConfirmButton: false,
    }).then(() => {
      window.location.reload();
    });
    setQuery('');
    setFiltered([]);
  };

  const [audioMimeType, setAudioMimeType] = useState('');

  const startListening = async () => {
    setTranscript('');
    transcriptRef.current = '';
    setFiltered([]);
    audioChunksRef.current = [];

    // Perekaman audio dilakukan lebih dulu dan pada KEDUA mode: model kita
    // bekerja dari audio, jadi tanpa rekaman tidak ada yang bisa diproses.
    // Dulu urutannya terbalik — Web Speech disiapkan lebih dulu dan alurnya
    // berhenti bila browser tidak mendukungnya, sehingga audio yang sudah
    // terekam pun tidak pernah terkirim.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
      else if (MediaRecorder.isTypeSupported('audio/mp4'))
        mimeType = 'audio/mp4';
      else if (MediaRecorder.isTypeSupported('audio/mpeg'))
        mimeType = 'audio/mpeg';
      else mimeType = '';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      setAudioMimeType(mimeType || mediaRecorder.mimeType);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        // Pada mode model-only tidak ada recognition.onend yang menutup alur,
        // jadi berhentinya perekaman itulah penanda ucapan selesai.
        if (!PAKAI_WEB_SPEECH) {
          setIsListening(false);
          processTransaction('');
        }
      };
      mediaRecorder.start();
    } catch (err) {
      Swal.fire('Error', 'Tidak dapat mengakses mikrofon', 'error');
      return;
    }

    // ── Mode model-only: selesai di sini, tidak ada layanan pihak ketiga ──
    if (!PAKAI_WEB_SPEECH) {
      setIsListening(true);
      // Penutup otomatis supaya kasir tidak perlu menekan tombol dua kali bila
      // lupa; menekan tombol lagi tetap menghentikan lebih awal.
      batasRekamRef.current = setTimeout(() => stopListening(), MAKS_REKAM_MS);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Swal.fire('Error', 'Browser tidak mendukung Web Speech API', 'error');
      stopListening();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      transcriptRef.current = text;
      setTranscript(text);
    };
    recognition.onerror = (e) => {
      console.error(e);
      Swal.fire('Error', 'Gagal menangkap suara', 'error');
      stopListening();
    };
    recognition.onend = () => {
      setIsListening(false);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === 'recording'
      ) {
        mediaRecorderRef.current.stop();
      }
      if (transcriptRef.current) {
        processTransaction(transcriptRef.current);
      } else {
        Swal.fire('Info', 'Tidak ada ucapan yang terekam', 'info');
      }
    };

    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (batasRekamRef.current) {
      clearTimeout(batasRekamRef.current);
      batasRekamRef.current = null;
    }
    if (recognitionRef.current) recognitionRef.current.stop();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const processTransaction = async (spokenText) => {
    if (!audioChunksRef.current.length) {
      Swal.fire('Info', 'Tidak ada suara yang terekam', 'info');
      return;
    }
    setIsProcessing(true);

    // Jumlah dari transkrip browser hanya dihitung pada mode hybrid. Pada mode
    // model-only field ini WAJIB dikirim 0: layanan memperlakukan field
    // `jumlah` sebagai setelan kasir yang selalu menang, jadi mengirim nilai
    // bawaan 1 akan diam-diam menimpa jumlah yang dibaca model dari audio.
    const jumlah = PAKAI_WEB_SPEECH ? parseJumlah(spokenText) || 1 : 0;

    await new Promise((resolve) => setTimeout(resolve, 300));

    const mimeType = audioMimeType || 'audio/webm';
    let audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

    try {
      audioBlob = await convertToWav(audioBlob);
    } catch (e) {
      console.warn("Gagal konversi ke WAV, menggunakan format asli:", e);
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('transcript', PAKAI_WEB_SPEECH ? spokenText : '');
    formData.append('jumlah', String(jumlah));

    try {
      // Waktu respons diukur di sini, bukan diperkirakan: stopwatch dimulai
      // tepat sebelum permintaan dikirim dan berhenti saat respons diterima,
      // jadi angkanya mencakup unggah audio, hop backend, dan inferensi model
      // — persis yang dirasakan kasir setelah selesai bicara.
      const tMulaiRequest = performance.now();
      const res = await api.post('/voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      const waktuResponsMs = performance.now() - tMulaiRequest;
      const waktuText = formatWaktuRespons(waktuResponsMs, res.data);

      if (!res.data.success || (!res.data.matchedProduct && (!res.data.produk_top3 || res.data.produk_top3.length <= 1))) {
        await Swal.fire({
          icon: 'warning',
          title: 'Kurang Jelas',
          html: `
            ${res.data.message || 'Suara tidak dikenali oleh model. Silakan coba lagi.'}
            <p style="margin-top: 8px;"><small>${waktuText}</small></p>
          `,
          confirmButtonText: 'OK'
        });
        return;
      }

      const {
        produk,
        jumlah: qty,
        harga,
        produk_conf,
        produk_match_score,
        produk_ctc_conf,
        produk_source,
        ambiguity_reason,
        produk_raw_text,
        matchedProduct,
        produk_top3,
      } = res.data;

      // Skor yang ditampilkan selalu hasil hitungan dari server:
      // produk_ctc_conf = rata-rata probabilitas softmax model pada frame
      //   non-blank; di popup ia diberi label "akurasi model" sesuai permintaan,
      //   walau secara teknis ini keyakinan (confidence) per ucapan, bukan
      //   akurasi agregat model. Akurasi agregat ada di notebook evaluasi.
      // produk_match_score = kecocokan transkrip CTC terhadap nama produk.
      const matchPct = ((produk_match_score ?? produk_conf ?? 0) * 100).toFixed(1);
      const ctcPct = ((produk_ctc_conf ?? 0) * 100).toFixed(1);
      const fromModel = produk_source === 'audio_model_ctc';
      const alasanPilihan = {
        skor_berdekatan:
          'Beberapa produk berskor hampir sama, model tidak bisa memisahkannya.',
        skor_belum_meyakinkan:
          'Skor tertinggi masih di bawah ambang yakin, jadi alternatifnya ikut ditawarkan.',
        banyak_kandidat_transkrip:
          'Kata kunci pada transkrip cocok ke beberapa produk sekaligus.',
      }[ambiguity_reason] || 'Model belum cukup yakin pada satu produk.';
      // Tiga kemungkinan sumber produk, dan kasir berhak tahu yang mana:
      //   audio_model_ctc     rescoring leksikon atas audio — jalur utama
      //   model_text_keyword  cadangan dari transkrip model SENDIRI (mode
      //                       model-only, saat rescoring di bawah ambang)
      //   transcript_keyword  cadangan dari transkrip browser (mode hybrid)
      const sourceNote = fromModel
        ? '<small style="color:#16a34a;">Sumber: model CNN-BiGRU-CTC</small>'
        : produk_source === 'model_text_keyword'
          ? '<small style="color:#d97706;">Sumber: transkrip model sendiri (rescoring di bawah ambang)</small>'
          : '<small style="color:#d97706;">Sumber: fallback transkrip browser (model di bawah ambang)</small>';

      // Prioritaskan pengecekan jika ditemukan banyak pilihan alternatif (lebih dari 1 item)
      if (produk_top3 && produk_top3.length > 1) {
        let optionsHtml = '<select id="swal-produk-select" class="swal2-input" style="width: 90%; max-width: 100%; height: 45px; padding: 8px 12px; font-size: 15px; border-radius: 8px; border: 1px solid #d1d5db; background-color: #f9fafb; outline: none; cursor: pointer;">';
        for (let item of produk_top3) {
          const name = Array.isArray(item) ? item[0] : item;
          const conf = Array.isArray(item) ? item[1] : 0;
          const label = `${name} — ${(conf * 100).toFixed(1)}%`;
          optionsHtml += `<option value="${name}" style="padding: 10px;">${label}</option>`;
        }
        optionsHtml += '</select>';

        const result = await Swal.fire({
          title: 'Pilih Produk:',
          html: `
            <p style="font-size: 14px; color: #666;">${alasanPilihan}</p>
            ${optionsHtml}
            <p style="margin-top: 10px;"><strong>Jumlah:</strong> ${qty}</p>
            <p style="margin-top: 4px;"><small>Transkrip model: "${produk_raw_text || '-'}" &middot; akurasi ${ctcPct}%</small></p>
            <p style="margin-top: 2px;"><small>${waktuText}</small></p>
            <p style="margin-top: 2px;">${sourceNote}</p>
          `,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Pilih & Tambahkan',
          cancelButtonText: 'Batal',
          preConfirm: () => {
            return document.getElementById('swal-produk-select').value;
          }
        });

        if (result.isConfirmed && result.value) {
          const selectedName = result.value;
          const foundProd = products.find(p => p.name.toLowerCase() === selectedName.toLowerCase());
          const selectedPrice = foundProd ? foundProd.price : (res.data.unit_price || 0);
          const selectedId = foundProd ? foundProd.id : selectedName;

          addItem({
            id: selectedId,
            name: selectedName,
            price: selectedPrice,
            qty: qty,
          });
          await Swal.fire(
            'Berhasil!',
            `${selectedName} ditambahkan ke keranjang`,
            'success',
          );
          window.location.reload();
        }
      } 
      else if (matchedProduct) {
        const result = await Swal.fire({
          title: 'Tambahkan ke Keranjang?',
          html: `
          <strong>Produk:</strong> ${produk}<br/>
          <strong>Jumlah:</strong> ${qty}<br/>
          <small>Akurasi model (CTC): ${ctcPct}% &middot; Kecocokan nama: ${matchPct}%</small><br/>
          <small>${waktuText}</small><br/>
          <small>Transkrip model: "${produk_raw_text || '-'}"</small><br/>
          ${sourceNote}
        `,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Ya, Tambahkan',
          cancelButtonText: 'Batal',
        });

        if (result.isConfirmed) {
          addItem({
            id: matchedProduct.id,
            name: matchedProduct.name,
            price: matchedProduct.price,
            qty: qty,
          });
          await Swal.fire(
            'Berhasil!',
            'Produk ditambahkan ke keranjang',
            'success',
          );
          window.location.reload();
        }
      } else {
        let top3Text = '';
        if (produk_top3 && produk_top3.length) {
          top3Text = '<br/><br/><strong>Alternatif teratas:</strong><ul>';
          for (let item of produk_top3) {
            const name = Array.isArray(item) ? item[0] : item;
            const conf = Array.isArray(item) ? item[1] : null;
            const label = conf === null ? '-' : `${(conf * 100).toFixed(1)}%`;
            top3Text += `<li>${name} (${label})</li>`;
          }
          top3Text += '</ul>';
        }
        await Swal.fire({
          title: 'Hasil Deteksi Suara',
          html: `
          Produk terdeteksi: <strong>${produk}</strong><br/>
          Jumlah: ${qty}<br/>
          Perkiraan harga: Rp ${harga.toLocaleString()}<br/>
          <small>Akurasi model (CTC): ${ctcPct}%</small><br/>
          <small>${waktuText}</small>${top3Text}
        `,
          icon: 'info',
          confirmButtonText: 'OK',
        });
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memproses suara. Coba lagi.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className='flex flex-col items-center py-4 gap-4'>
      <div className='relative w-full max-w-md'>
        <input
          type='text'
          placeholder='Cari produk...'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className='w-full p-3 border border-gray-300 rounded-lg'
        />
        <FaSearch className='absolute right-3 top-4 text-gray-400' />
        {filtered.length > 0 && (
          <ul className='absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-60 overflow-auto'>
            {filtered.map((p) => (
              <li
                key={p.id}
                onClick={() => handleAddProduct(p)}
                className='p-2 hover:bg-gray-100 cursor-pointer flex justify-between'
              >
                <span>{p.name}</span>
                <span>Rp {p.price.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing}
        className={`flex p-5 border rounded-xl transition-all ${
          isProcessing
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : isListening
              ? 'bg-white text-red-500 border-red-500'
              : 'bg-sky-950 text-white hover:bg-white hover:text-sky-950'
        }`}
      >
        {isProcessing ? (
          <FaSyncAlt className='animate-spin' size={28} />
        ) : (
          <FaMicrophone size={28} />
        )}
      </button>

      <p className='text-sm text-gray-400'>
        {isProcessing
          ? 'Memproses suara...'
          : isListening
            ? 'Mendengarkan... (klik lagi untuk berhenti)'
            : 'Tekan mikrofon untuk perintah suara'}
      </p>

      <p className='text-sm text-gray-400'>
        Contoh: "Indomie Goreng 3"
      </p>
    </div>
  );
}

export default InputPos;
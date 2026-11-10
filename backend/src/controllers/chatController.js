const prisma = require('../config/prisma');
const axios = require('axios'); // tidak dipakai, biarkan saja

// ========== MENU UTAMA (MVP: voice recognition, transaksi, stok, hutang, tips) ==========
const mainMenuReplies = [
  { id: 'catat', label: '🎤 Catat Transaksi (Suara)' },
  { id: 'lihat_transaksi', label: '📋 Lihat Transaksi' },
  { id: 'stok', label: '📦 Manajemen Stok' },
  { id: 'hutang', label: '💰 Hutang/Piutang' },
  { id: 'tips', label: '💡 Tips UMKM' },
];

// Fungsi untuk menghasilkan balasan bersih (HTML) dan quick replies
function getResponseAndMenu(message, currentState = 'main') {
  const lowerMsg = message.trim().toLowerCase();

  // Perintah global kembali ke menu utama
  if (lowerMsg === 'menu' || lowerMsg === 'kembali' || lowerMsg === 'back') {
    return {
      replyText: 'Kembali ke menu utama. Pilih topik yang Anda butuhkan:',
      nextState: 'main',
      quickReplies: mainMenuReplies,
    };
  }

  // ========== HANDLE SUBMENU BERDASARKAN STATE ==========
  if (currentState !== 'main') {
    // --- Catat Transaksi ---
    if (currentState === 'catat') {
      if (lowerMsg.includes('suara') || lowerMsg.includes('voice')) {
        return {
          replyText: `
            <strong>🎤 Cara Catat Transaksi dengan Suara:</strong><br/>
            1. Buka halaman <strong>POS Terminal</strong><br/>
            2. Klik ikon mikrofon 🎙️<br/>
            3. Ucapkan, misal: <em>"jual minyak goreng ABC 1 Liter 5 Botol"</em><br/>
            Sistem akan otomatis mencatat ke cart. Mudah, kan?
          `,
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else if (lowerMsg.includes('manual')) {
        return {
          replyText: `
            <strong>📝 Catat Manual:</strong><br/>
            Jika tidak ingin menggunakan suara, buka halaman <strong>Transaksi</strong> dan isi form secara manual.
          `,
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else {
        return {
          replyText: 'Pilih metode pencatatan:',
          nextState: 'catat',
          quickReplies: [
            { id: 'suara', label: '🎙️ Catat dengan Suara' },
            { id: 'manual', label: '✍️ Catat Manual' },
            { id: 'back', label: '🔙 Kembali' },
          ],
        };
      }
    }

    // --- Lihat Transaksi ---
    if (currentState === 'lihat_transaksi') {
      if (lowerMsg.includes('hari ini') || lowerMsg.includes('harian')) {
        return {
          replyText:
            '📅 <strong>Transaksi Hari Ini</strong><br/>Buka menu <strong>Transaksi</strong> lalu pilih filter "Hari ini" untuk melihat semua pemasukan & pengeluaran hari ini.',
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else if (
        lowerMsg.includes('bulan ini') ||
        lowerMsg.includes('bulanan')
      ) {
        return {
          replyText:
            '📆 <strong>Transaksi Bulan Ini</strong><br/>Di halaman Transaksi, atur filter periode ke bulan saat ini. Anda juga bisa melihat ringkasan di Dashboard.',
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else {
        return {
          replyText: 'Lihat transaksi berdasarkan periode:',
          nextState: 'lihat_transaksi',
          quickReplies: [
            { id: 'hari_ini', label: '📅 Hari Ini' },
            { id: 'bulan_ini', label: '📆 Bulan Ini' },
            { id: 'back', label: '🔙 Kembali' },
          ],
        };
      }
    }

    // --- Manajemen Stok ---
    if (currentState === 'stok') {
      if (lowerMsg.includes('tambah') || lowerMsg.includes('masuk')) {
        return {
          replyText:
            '📦 <strong>Tambah Stok</strong><br/>Buka menu <strong>Produk</strong>, pilih produk, lalu klik "Tambah Stok". Atau gunakan fitur <strong>Stok Masuk</strong> di halaman Stok.',
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else if (lowerMsg.includes('kurang') || lowerMsg.includes('keluar')) {
        return {
          replyText:
            '📤 <strong>Kurangi Stok</strong><br/>Setiap transaksi penjualan akan otomatis mengurangi stok. Jika ingin manual, buka menu <strong>Stok</strong> dan pilih "Stok Keluar".',
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else {
        return {
          replyText: 'Manajemen stok: pilih aksi yang diinginkan.',
          nextState: 'stok',
          quickReplies: [
            { id: 'tambah_stok', label: '📥 Tambah Stok' },
            { id: 'kurang_stok', label: '📤 Kurangi Stok' },
            { id: 'back', label: '🔙 Kembali' },
          ],
        };
      }
    }

    // --- Hutang/Piutang ---
    if (currentState === 'hutang') {
      if (lowerMsg.includes('piutang') || lowerMsg.includes('kasbon')) {
        return {
          replyText:
            '💸 <strong>Mencatat Piutang</strong><br/>Buka menu <strong>Hutang/Piutang</strong>, lalu pilih "Tambah Piutang". Masukkan nama pelanggan, jumlah, dan jatuh tempo.',
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else if (lowerMsg.includes('hutang') || lowerMsg.includes('utang')) {
        return {
          replyText:
            '📉 <strong>Mencatat Hutang</strong><br/>Di menu Hutang/Piutang, pilih "Tambah Hutang". Catat utang Anda ke supplier atau pihak lain.',
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else {
        return {
          replyText: 'Kelola hutang/piutang: pilih jenis yang akan dicatat.',
          nextState: 'hutang',
          quickReplies: [
            { id: 'piutang', label: '📝 Catat Piutang' },
            { id: 'hutang', label: '📝 Catat Hutang' },
            { id: 'back', label: '🔙 Kembali' },
          ],
        };
      }
    }

    // --- Tips UMKM ---
    if (currentState === 'tips') {
      if (lowerMsg.includes('stok') || lowerMsg.includes('persediaan')) {
        return {
          replyText:
            '💡 <strong>Tips Manajemen Stok</strong><br/>Gunakan metode FIFO (First In First Out) untuk produk kadaluwarsa. Lakukan stock opname setiap minggu.',
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else if (
        lowerMsg.includes('transaksi') ||
        lowerMsg.includes('penjualan')
      ) {
        return {
          replyText:
            '💡 <strong>Tips Pencatatan Transaksi</strong><br/>Catat setiap transaksi sekecil apapun. Gunakan voice recognition agar lebih cepat.',
          nextState: 'main',
          quickReplies: mainMenuReplies,
        };
      } else {
        return {
          replyText: 'Pilih tips yang Anda butuhkan:',
          nextState: 'tips',
          quickReplies: [
            { id: 'tips_stok', label: '📦 Manajemen Stok' },
            { id: 'tips_transaksi', label: '💳 Pencatatan Transaksi' },
            { id: 'back', label: '🔙 Kembali' },
          ],
        };
      }
    }

    // fallback
    return {
      replyText: 'Maaf, terjadi kesalahan. Kembali ke menu utama.',
      nextState: 'main',
      quickReplies: mainMenuReplies,
    };
  }

  // ========== STATE MAIN ==========
  // Deteksi keyword untuk memilih topik utama
  if (
    lowerMsg.includes('catat') ||
    lowerMsg.includes('transaksi') ||
    lowerMsg.includes('suara') ||
    lowerMsg.includes('voice')
  ) {
    return {
      replyText:
        '🎤 <strong>Pencatatan Transaksi dengan Suara</strong><br/>Pilih metode yang Anda inginkan:',
      nextState: 'catat',
      quickReplies: [
        { id: 'suara', label: '🎙️ Catat dengan Suara' },
        { id: 'manual', label: '✍️ Catat Manual' },
        { id: 'back', label: '🔙 Kembali' },
      ],
    };
  }
  if (lowerMsg.includes('lihat') || lowerMsg.includes('riwayat')) {
    return {
      replyText:
        '📋 <strong>Lihat Transaksi</strong><br/>Pilih periode laporan transaksi:',
      nextState: 'lihat_transaksi',
      quickReplies: [
        { id: 'hari_ini', label: '📅 Hari Ini' },
        { id: 'bulan_ini', label: '📆 Bulan Ini' },
        { id: 'back', label: '🔙 Kembali' },
      ],
    };
  }
  if (
    lowerMsg.includes('stok') ||
    lowerMsg.includes('produk') ||
    lowerMsg.includes('barang')
  ) {
    return {
      replyText:
        '📦 <strong>Manajemen Stok</strong><br/>Apa yang ingin Anda lakukan?',
      nextState: 'stok',
      quickReplies: [
        { id: 'tambah_stok', label: '📥 Tambah Stok' },
        { id: 'kurang_stok', label: '📤 Kurangi Stok' },
        { id: 'back', label: '🔙 Kembali' },
      ],
    };
  }
  if (
    lowerMsg.includes('hutang') ||
    lowerMsg.includes('piutang') ||
    lowerMsg.includes('utang')
  ) {
    return {
      replyText:
        '💰 <strong>Hutang & Piutang</strong><br/>Pilih jenis yang akan dicatat:',
      nextState: 'hutang',
      quickReplies: [
        { id: 'piutang', label: '📝 Catat Piutang' },
        { id: 'hutang', label: '📝 Catat Hutang' },
        { id: 'back', label: '🔙 Kembali' },
      ],
    };
  }
  if (
    lowerMsg.includes('tips') ||
    lowerMsg.includes('saran') ||
    lowerMsg.includes('bantuan')
  ) {
    return {
      replyText: '💡 <strong>Tips UMKM</strong><br/>Pilih topik tips:',
      nextState: 'tips',
      quickReplies: [
        { id: 'tips_stok', label: '📦 Manajemen Stok' },
        { id: 'tips_transaksi', label: '💳 Pencatatan Transaksi' },
        { id: 'back', label: '🔙 Kembali' },
      ],
    };
  }

  // default ketika tidak ada keyword cocok
  return {
    replyText:
      'Halo! Saya asisten FinSense. <strong>Silakan pilih menu</strong> di bawah atau ketik salah satu topik seperti "catat transaksi", "lihat transaksi", "stok", "hutang", atau "tips".',
    nextState: 'main',
    quickReplies: mainMenuReplies,
  };
}

// ========== ENDPOINT sendMessage ==========
exports.sendMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let session = await prisma.aiChatSession.findFirst({
      where: { id: sessionId, user_id: req.userId },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const currentState = session.context_summary || 'main';
    const { replyText, nextState, quickReplies } = getResponseAndMenu(
      message,
      currentState,
    );

    // Simpan pesan user
    await prisma.aiMessage.create({
      data: { session_id: sessionId, role: 'user', content: message },
    });

    // Simpan balasan AI
    const assistantMsg = await prisma.aiMessage.create({
      data: {
        session_id: sessionId,
        role: 'assistant',
        content: replyText,
        model_used: 'rule-based-mvp',
      },
    });

    // Update session state
    await prisma.aiChatSession.update({
      where: { id: sessionId },
      data: {
        last_active_at: new Date(),
        message_count: { increment: 2 },
        context_summary: nextState,
      },
    });

    res.json({
      assistantMessage: assistantMsg,
      quickReplies: quickReplies,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ========== FUNGSI LAINNYA (getSessions, createSession, getMessages, deleteSession) ==========
exports.getSessions = async (req, res) => {
  try {
    const sessions = await prisma.aiChatSession.findMany({
      where: { user_id: req.userId },
      orderBy: { last_active_at: 'desc' },
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSession = async (req, res) => {
  try {
    const { session_title } = req.body;
    const session = await prisma.aiChatSession.create({
      data: {
        user_id: req.userId,
        session_title: session_title || 'Chat baru',
      },
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await prisma.aiMessage.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: 'asc' },
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await prisma.aiChatSession.delete({
      where: { id: sessionId, user_id: req.userId },
    });
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

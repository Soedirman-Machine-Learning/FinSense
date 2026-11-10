const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const crypto = require('crypto');
const { sendResetEmail } = require('../services/emailService');

function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function generateRefreshToken(userId) {
  // crypto.randomUUID() bawaan Node, bukan paket `uuid`. uuid versi 14 hanya
  // tersedia sebagai ES Module; me-require()-nya lolos di Node terbaru di
  // laptop, tapi di runtime Vercel melempar ERR_REQUIRE_ESM saat modul ini
  // dimuat — dan karena itu terjadi saat startup, SEMUA endpoint jadi 500.
  // Hasilnya sama-sama UUID v4.
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.refreshToken.create({
    data: { token, user_id: userId, expiresAt },
  });
  return token;
}

exports.register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name) {
      return res
        .status(400)
        .json({ error: 'Email, password, full_name required' });
    }
    
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing)
      return res.status(400).json({ error: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password_hash: hashed, full_name },
    });
    res.status(201).json({ message: 'User created', userId: user.id });
  } catch (err) {
    // Detail lengkap hanya untuk log server, jangan dikirim ke client
    console.error('DETIL ERROR REGISTER:', err);
    res.status(500).json({ error: 'Registrasi gagal. Coba lagi nanti.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email, full_name: user.full_name },
    });
  } catch (err) {
    console.error('DETIL ERROR LOGIN:', err);
    res.status(500).json({ error: 'Login gagal. Coba lagi nanti.' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ error: 'Refresh token required' });

    const tokenDoc = await prisma.refreshToken.findFirst({
      where: { token: refreshToken },
      include: { user: true },
    });
    if (!tokenDoc || tokenDoc.revoked || tokenDoc.expiresAt < new Date()) {
      return res
        .status(403)
        .json({ error: 'Invalid or expired refresh token' });
    }

    const newAccessToken = generateAccessToken(tokenDoc.user_id);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error('DETIL ERROR REFRESH TOKEN:', err);
    res.status(500).json({ error: 'Gagal memperbarui sesi. Silakan login ulang.' });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('DETIL ERROR LOGOUT:', err);
    res.status(500).json({ error: 'Logout gagal. Coba lagi nanti.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        is_verified: true,
        created_at: true,
        umkm_profile: true,
      },
    });
    res.json(user);
  } catch (err) {
    console.error('DETIL ERROR GET PROFILE:', err);
    res.status(500).json({ error: 'Gagal memuat profil. Coba lagi nanti.' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized: user ID missing' });
    }
    const { full_name, email } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { full_name, email },
      select: { id: true, email: true, full_name: true },
    });
    res.json(user);
  } catch (err) {
    console.error('DETIL ERROR UPDATE PROFILE:', err);
    res.status(500).json({ error: 'Gagal menyimpan profil. Coba lagi nanti.' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Email tidak terdaftar' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    await prisma.user.updateMany({
      where: { email },
      data: {
        reset_token: resetToken,
        reset_token_expiry: resetTokenExpiry,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const userName = user.full_name || user.email.split('@')[0] || 'Pengguna';

    await sendResetEmail(email, resetLink, userName);

    res.json({ message: 'Link reset password telah dikirim ke email Anda' });
  } catch (err) {
    console.error('DETIL ERROR FORGOT PASSWORD:', err);
    res.status(500).json({ error: 'Gagal mengirim email. Coba lagi nanti.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await prisma.user.findFirst({
      where: {
        reset_token: token,
        reset_token_expiry: { gt: new Date() },
      },
    });
    if (!user) {
      return res
        .status(400)
        .json({ error: 'Token tidak valid atau sudah kadaluarsa' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
      },
    });

    res.json({ message: 'Password berhasil direset. Silakan login.' });
  } catch (err) {
    console.error('DETIL ERROR RESET PASSWORD:', err);
    res.status(500).json({ error: 'Gagal mereset password' });
  }
};
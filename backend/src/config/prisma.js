// Pool dibuat saat modul ini dimuat, jadi variabel .env harus sudah tersedia
// lebih dulu. Memuat dotenv di sini membuat modul aman dipakai dari titik masuk
// mana pun — server.js, prisma/seed.js, maupun skrip sekali jalan — tanpa
// bergantung pada urutan require. config() tidak menimpa env yang sudah ada.
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const mariadb = require('mariadb');

const dbHost = process.env.DB_HOST || 'localhost';

// MySQL 8 memakai caching_sha2_password. Selama hash password masih ada di
// cache server, koneksi TCP biasa lolos lewat jalur cepat. Setelah MySQL
// restart (termasuk setiap kali laptop reboot) cache itu kosong, dan koneksi
// pertama wajib autentikasi penuh — yang tanpa TLS membutuhkan kunci publik RSA
// server. Driver mariadb menolak mengambil kunci itu kecuali diizinkan, lalu
// pool membungkus penolakan tersebut jadi pesan menyesatkan:
//   "pool failed to retrieve a connection from pool (active=0 idle=0)"
// Gejalanya: backend jalan normal kemarin, lalu gagal total setelah reboot.
//
// Izin ini hanya diberikan untuk server di mesin yang sama. Mengambil kunci
// publik dari server jarak jauh lewat koneksi tanpa TLS membuka celah
// man-in-the-middle, jadi database remote harus memakai TLS, bukan opsi ini.
const isLocalDb = ['localhost', '127.0.0.1', '::1'].includes(dbHost);

// Membuat pool menggunakan objek konfigurasi (aman dari error parsing URL)
const pool = mariadb.createPool({
  host: dbHost,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'finsense_db',
  connectionLimit: 5,
  allowPublicKeyRetrieval: isLocalDb,
  // Database di luar mesin ini wajib lewat TLS. TiDB Cloud menolak koneksi
  // tanpa TLS sama sekali, dan untuk layanan lain pun password tidak boleh
  // melintas internet tanpa enkripsi. Sertifikatnya diverifikasi terhadap CA
  // bawaan Node, jadi tidak ada berkas CA yang perlu ikut di-deploy.
  ssl: isLocalDb ? undefined : { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  // Batas waktu koneksi bawaan driver mariadb hanya 1000 ms. Jabat tangan TLS
  // ke database lintas internet terukur ~1400 ms, sehingga dengan nilai bawaan
  // SETIAP koneksi dibatalkan sebelum tersambung — dan pool melaporkannya
  // sebagai "pool failed to retrieve a connection", tanpa menyebut timeout.
  // Untuk database lokal nilai bawaan dibiarkan supaya kegagalan cepat terlihat.
  connectTimeout: isLocalDb ? undefined : 10000,
});

const adapter = new PrismaMariaDb(pool);

const prisma = new PrismaClient({
  adapter,
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
});

module.exports = prisma;
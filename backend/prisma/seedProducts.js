/**
 * Seed 121 produk yang dikenali model suara ke database.
 * =====================================================
 *
 * Model CNN-BiGRU-CTC mengenali 121 nama produk, tapi database pengembangan
 * hanya berisi sebagian kecil. Akibatnya suara dikenali dengan benar namun
 * `matchedProduct` bernilai null sehingga tidak pernah masuk keranjang — gejala
 * yang mudah disalahartikan sebagai kegagalan model.
 *
 * Daftar produk dan harganya diambil dari ai-service/model_v10/unit_price_lookup.json,
 * yaitu sumber yang sama dengan yang dipakai layanan AI untuk menghitung harga.
 *
 * Harga produk yang SUDAH ADA tidak diubah secara diam-diam. Harga di database
 * bisa saja sengaja disunting kasir, dan menimpanya tanpa diminta berarti
 * mengubah angka transaksi. Selisih yang ditemukan dilaporkan, dan baru
 * disamakan bila dijalankan dengan --sync-prices.
 *
 * Menjalankan:
 *     cd backend
 *     node prisma/seedProducts.js                 # tambah yang belum ada
 *     node prisma/seedProducts.js --sync-prices   # + samakan harga yang berbeda
 *     node prisma/seedProducts.js --user <uuid>   # pilih pemilik secara eksplisit
 */

const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');

const LOOKUP = path.join(
  __dirname, '..', '..', 'ai-service', 'model_v10', 'unit_price_lookup.json',
);

const STOK_AWAL = 50; // cukup agar produk bisa dipakai menguji alur POS
const SATUAN = 'pcs';

function arg(nama) {
  const i = process.argv.indexOf(nama);
  return i === -1 ? null : process.argv[i + 1];
}

async function tentukanUser() {
  const diminta = arg('--user') || process.env.SEED_USER_ID;
  if (diminta) {
    const u = await prisma.user.findUnique({ where: { id: diminta } });
    if (!u) throw new Error(`user ${diminta} tidak ada di database`);
    return u;
  }
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  if (users.length === 0) throw new Error('belum ada user — daftar dulu lewat aplikasi');
  if (users.length > 1) {
    throw new Error(
      `ada ${users.length} user, sebutkan pemiliknya: node prisma/seedProducts.js --user <uuid>`,
    );
  }
  return users[0];
}

async function main() {
  const sync = process.argv.includes('--sync-prices');
  const user = await tentukanUser();
  console.log(`pemilik produk : ${user.id}`);

  const { unit_price_lookup: lookup } = JSON.parse(fs.readFileSync(LOOKUP, 'utf8'));
  const daftar = Object.entries(lookup);
  console.log(`produk di lookup: ${daftar.length}`);

  const adaSekarang = await prisma.product.findMany({
    where: { user_id: user.id },
    select: { id: true, name: true, price: true },
  });
  const byName = new Map(adaSekarang.map((p) => [p.name.toLowerCase().trim(), p]));

  let dibuat = 0;
  const bedaHarga = [];

  for (const [nama, harga] of daftar) {
    const kunci = nama.toLowerCase().trim();
    const lama = byName.get(kunci);

    if (!lama) {
      await prisma.product.create({
        data: {
          user_id: user.id,
          name: nama,
          price: harga,
          stock: STOK_AWAL,
          unit: SATUAN,
        },
      });
      dibuat++;
      continue;
    }

    if (Math.abs((lama.price ?? 0) - harga) >= 0.01) {
      bedaHarga.push({ nama, db: lama.price, lookup: harga, id: lama.id });
    }
  }

  console.log(`\nproduk baru dibuat : ${dibuat}`);
  console.log(`sudah ada sebelumnya: ${daftar.length - dibuat}`);

  if (bedaHarga.length) {
    console.log(`\nharga BERBEDA antara database dan lookup AI (${bedaHarga.length}):`);
    for (const b of bedaHarga) {
      console.log(
        `  ${b.nama.slice(0, 44).padEnd(46)} DB ${String(b.db).padStart(7)}` +
        `  lookup ${String(b.lookup).padStart(7)}`,
      );
    }
    if (sync) {
      for (const b of bedaHarga) {
        await prisma.product.update({ where: { id: b.id }, data: { price: b.lookup } });
      }
      console.log(`\n${bedaHarga.length} harga disamakan dengan lookup AI.`);
    } else {
      console.log(
        '\nHarga di atas TIDAK diubah. Selama masih berbeda, field `harga` dari\n' +
        'layanan AI tidak akan cocok dengan `matchedProduct.price` dari database.\n' +
        'Jalankan dengan --sync-prices bila ingin disamakan.',
      );
    }
  }

  const total = await prisma.product.count({ where: { user_id: user.id } });
  console.log(`\ntotal produk milik user ini: ${total}`);
}

main()
  .catch((e) => {
    console.error('GAGAL:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // prisma.$disconnect() TIDAK menutup pool mariadb yang dibuat di
    // src/config/prisma.js — pool itu milik adapter, bukan milik Prisma. Tanpa
    // exit eksplisit, event loop tetap hidup dan skrip menggantung selamanya
    // meski seluruh pekerjaannya sudah selesai. (prisma/seed.js punya pola yang
    // sama dan gejalanya sama.)
    process.exit(process.exitCode || 0);
  });

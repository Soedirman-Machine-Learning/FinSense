const prisma = require('../src/config/prisma');
async function main() {
  const categories = [
    { name: 'Penjualan', type: 'income', is_default: true },
    { name: 'Restok', type: 'expense', is_default: true },
    { name: 'Operasional', type: 'expense', is_default: true },
    { name: 'Gaji Karyawan', type: 'expense', is_default: true },
    { name: 'Pendapatan Lain', type: 'income', is_default: true },
    { name: 'Pengeluaran Lain', type: 'expense', is_default: true },
  ];

  for (const cat of categories) {
    await prisma.transactionCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log('Seed kategori selesai');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());

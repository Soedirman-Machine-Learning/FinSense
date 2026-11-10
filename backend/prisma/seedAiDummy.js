require('dotenv').config(); // Load environment variables from .env
const prisma = require('../src/config/prisma');

// Konfigurasi
const USER_ID = process.env.SEED_USER_ID || null; // Bisa isi UUID manual di .env
const DAYS_BACK = 14; // 14 hari kebelakang
const MIN_AMOUNT = 20000;
const MAX_AMOUNT = 150000;
const MIN_TX_PER_DAY = 50; // minimal 50 transaksi per hari
const MAX_TX_PER_DAY = 80; // maksimal 80 per hari

async function getProducts() {
  return await prisma.product.findMany({
    where: { user_id: USER_ID },
    select: { id: true, name: true, price: true, stock: true },
  });
}

async function getIncomeCategory() {
  let category = await prisma.transactionCategory.findFirst({
    where: { type: 'income' },
  });
  if (!category) {
    // Jika tidak ada, buat category income default
    category = await prisma.transactionCategory.create({
      data: {
        name: 'Penjualan',
        type: 'income',
        is_default: true,
      },
    });
  }
  return category;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(startDate, endDate) {
  return new Date(
    startDate.getTime() +
      Math.random() * (endDate.getTime() - startDate.getTime()),
  );
}

async function seed() {
  console.log(`🌱 Seeding dummy transactions for user ${USER_ID}...`);

  const products = await getProducts();
  if (products.length === 0) {
    console.error('❌ Tidak ada produk. Silakan buat produk terlebih dahulu.');
    return;
  }
  console.log(`✅ Found ${products.length} products.`);

  const category = await getIncomeCategory();
  console.log(`📂 Using category: ${category.name} (id: ${category.id})`);

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_BACK);
  startDate.setHours(0, 0, 0, 0);

  let totalTransactions = 0;
  let totalItems = 0;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const txCount = randomInt(MIN_TX_PER_DAY, MAX_TX_PER_DAY);
    console.log(
      `📅 Processing ${date.toISOString().split('T')[0]} with ${txCount} transactions...`,
    );

    for (let i = 0; i < txCount; i++) {
      const itemCount = randomInt(1, 4);
      const items = [];
      let totalAmount = 0;

      // Generate items for this transaction
      for (let j = 0; j < itemCount; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = randomInt(1, 3);
        const unitPrice = product.price || randomInt(5000, 50000);
        const totalPrice = quantity * unitPrice;
        totalAmount += totalPrice;
        items.push({
          item_name: product.name,
          quantity: quantity,
          unit: 'pcs',
          unit_price: unitPrice,
          total_price: totalPrice,
          product_id: product.id,
        });
      }

      // Adjust total amount if out of range
      if (totalAmount < MIN_AMOUNT)
        totalAmount = randomInt(MIN_AMOUNT, MAX_AMOUNT);
      if (totalAmount > MAX_AMOUNT)
        totalAmount = randomInt(MIN_AMOUNT, MAX_AMOUNT);

      const transactionTime = randomDate(
        date,
        new Date(date.getTime() + 86400000),
      );

      // Create transaction with nested items
      await prisma.transaction.create({
        data: {
          user_id: USER_ID,
          category_id: category.id,
          type: 'income',
          amount: totalAmount,
          description: `Penjualan POS - ${itemCount} item`,
          transaction_date: transactionTime,
          source: 'manual',
          is_anomaly: false,
          items: {
            create: items.map((item) => ({
              item_name: item.item_name,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unit_price,
              total_price: item.total_price,
              product_id: item.product_id,
            })),
          },
        },
      });

      totalTransactions++;
      totalItems += items.length;
    }
    console.log(
      `   ✅ ${txCount} transactions created for ${date.toISOString().split('T')[0]}`,
    );
  }

  console.log(
    `🎉 Seeding completed! ${totalTransactions} transactions with ${totalItems} items.`,
  );
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

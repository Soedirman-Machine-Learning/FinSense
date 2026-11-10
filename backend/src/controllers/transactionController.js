const prisma = require('../config/prisma');

// ==================== HELPER FUNCTIONS ====================

/**
 * Membuat transaksi beserta item-itemnya dalam satu transaction database.
 * @param {string} userId - ID user pemilik
 * @param {Object} data - { category_id, type, amount, description, transaction_date, source, items }
 * @returns {Promise<Object>} Transaksi yang sudah dibuat
 */
async function createTransactionWithItems(userId, data) {
  const {
    category_id,
    type,
    amount,
    description,
    transaction_date,
    source,
    items,
  } = data;

  return await prisma.$transaction(async (tx) => {
    // 1. Buat header transaksi
    const transaction = await tx.transaction.create({
      data: {
        user_id: userId,
        category_id: parseInt(category_id),
        type,
        amount: parseFloat(amount),
        description,
        transaction_date: transaction_date
          ? new Date(transaction_date)
          : new Date(),
        source: source || 'manual',
      },
    });

    // 2. Jika ada items, buat detail items
    if (items && Array.isArray(items) && items.length > 0) {
      const itemData = items.map((item) => ({
        transaction_id: transaction.id,
        item_name: item.item_name,
        quantity: parseFloat(item.quantity),
        unit: item.unit || null,
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.quantity) * parseFloat(item.unit_price),
        category_id: item.category_id ? parseInt(item.category_id) : null,
        product_id: item.product_id || null,
        ai_confidence: item.ai_confidence || null,
      }));
      await tx.transactionItem.createMany({ data: itemData });
    }

    return transaction;
  });
}

/**
 * Mengupdate transaksi beserta item-itemnya.
 * Menghapus semua item lama lalu membuat ulang (jika items diberikan).
 * @param {string} transactionId - ID transaksi yang akan diupdate
 * @param {string} userId - Untuk verifikasi kepemilikan (tidak digunakan dalam update, tapi untuk safety)
 * @param {Object} data - Field yang akan diupdate
 * @returns {Promise<Object>} Transaksi yang sudah diupdate
 */
async function updateTransactionWithItems(transactionId, userId, data) {
  const {
    category_id,
    type,
    amount,
    description,
    transaction_date,
    source,
    items,
  } = data;

  return await prisma.$transaction(async (tx) => {
    // 1. Update header
    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: {
        category_id: category_id ? parseInt(category_id) : undefined,
        type: type || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        description: description !== undefined ? description : undefined,
        transaction_date: transaction_date
          ? new Date(transaction_date)
          : undefined,
        source: source || undefined,
      },
    });

    // 2. Jika items diberikan (termasuk array kosong), hapus semua item lama lalu buat baru
    if (items !== undefined) {
      await tx.transactionItem.deleteMany({
        where: { transaction_id: transactionId },
      });
      if (Array.isArray(items) && items.length > 0) {
        const itemData = items.map((item) => ({
          transaction_id: transactionId,
          item_name: item.item_name,
          quantity: parseFloat(item.quantity),
          unit: item.unit || null,
          unit_price: parseFloat(item.unit_price),
          total_price: parseFloat(item.quantity) * parseFloat(item.unit_price),
          category_id: item.category_id ? parseInt(item.category_id) : null,
          product_id: item.product_id || null,
          ai_confidence: item.ai_confidence || null,
        }));
        await tx.transactionItem.createMany({ data: itemData });
      }
    }

    return updated;
  });
}

// ==================== CONTROLLERS ====================

// GET /transactions
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate, category, type, includeItems } = req.query;

    let where = { user_id: userId };
    if (startDate) where.transaction_date = { gte: new Date(startDate) };
    if (endDate) {
      where.transaction_date = {
        ...where.transaction_date,
        lte: new Date(endDate),
      };
    }
    if (category) where.category_id = parseInt(category);
    if (type) where.type = type;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        // Hanya include items jika parameter 'includeItems' bernilai 'true'
        ...(includeItems === 'true' && { items: true }),
      },
      orderBy: { transaction_date: 'desc' },
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /transactions/:id
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const transaction = await prisma.transaction.findFirst({
      where: { id, user_id: userId },
      include: {
        category: true,
        items: true, // selalu sertakan items untuk detail
      },
    });
    if (!transaction)
      return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /transactions
exports.createTransaction = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      category_id,
      type,
      amount,
      description,
      transaction_date,
      source,
      items,
    } = req.body;

    if (!category_id || !type || !amount) {
      return res
        .status(400)
        .json({ error: 'Missing required fields (category_id, type, amount)' });
    }

    const transaction = await createTransactionWithItems(userId, {
      category_id,
      type,
      amount,
      description,
      transaction_date,
      source,
      items,
    });

    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /transactions/:id
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const {
      category_id,
      type,
      amount,
      description,
      transaction_date,
      source,
      items,
    } = req.body;

    // Verifikasi kepemilikan
    const existing = await prisma.transaction.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing)
      return res.status(404).json({ error: 'Transaction not found' });

    const updated = await updateTransactionWithItems(id, userId, {
      category_id,
      type,
      amount,
      description,
      transaction_date,
      source,
      items,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /transactions/:id
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Cek kepemilikan
    const existing = await prisma.transaction.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing)
      return res.status(404).json({ error: 'Transaction not found' });

    // Hapus transaksi (cascade delete items karena foreign key onDelete Cascade)
    await prisma.transaction.delete({ where: { id } });
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

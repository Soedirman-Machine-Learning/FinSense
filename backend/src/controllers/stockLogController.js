const prisma = require('../config/prisma');

// GET /stock-logs - semua log stok milik user
exports.getStockLogs = async (req, res) => {
  try {
    const userId = req.userId;
    const { product_id, status, startDate, endDate } = req.query;

    const where = { user_id: userId };
    if (product_id) where.product_id = product_id;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const logs = await prisma.stockLog.findMany({
      where,
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// POST /stock-logs - tambah log manual
exports.createStockLog = async (req, res) => {
  try {
    const userId = req.userId;
    const { product_id, type, quantity, note, operator, status } = req.body;

    if (!product_id || !type || !quantity) {
      return res
        .status(400)
        .json({ error: 'product_id, type, quantity required' });
    }

    // Cek produk milik user
    const product = await prisma.product.findFirst({
      where: { id: product_id, user_id: userId },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Update stok otomatis berdasarkan type
    let newStock = product.stock;
    if (type === 'in') newStock += parseInt(quantity);
    else if (type === 'out') newStock -= parseInt(quantity);
    else if (type === 'adjust')
      newStock = parseInt(quantity); // adjust langsung set stok ke quantity
    else
      return res.status(400).json({ error: 'type must be in, out, or adjust' });

    if (newStock < 0)
      return res.status(400).json({ error: 'Stock cannot be negative' });

    // Gunakan transaction untuk update stok dan buat log
    const result = await prisma.$transaction([
      prisma.product.update({
        where: { id: product_id },
        data: { stock: newStock },
      }),
      prisma.stockLog.create({
        data: {
          product_id,
          user_id: userId,
          type: type === 'in' ? 'in' : type === 'out' ? 'out' : 'adjust',
          quantity: parseInt(quantity),
          note: note || null,
          operator: operator || req.user?.full_name || 'system',
          status: status === 'pending_audit' ? 'pending_audit' : 'completed',
        },
      }),
    ]);
    res.status(201).json({
      message: 'Stock log created',
      product: result[0],
      log: result[1],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /stock-logs/:id - edit log
exports.updateStockLog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { status, note } = req.body;

    const existing = await prisma.stockLog.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) return res.status(404).json({ error: 'Log not found' });

    const updated = await prisma.stockLog.update({
      where: { id },
      data: {
        status: status || existing.status,
        note: note !== undefined ? note : existing.note,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /stock-logs/:id - hapus log (tidak mengembalikan stok, hanya untuk pembatalan pencatatan)
exports.deleteStockLog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const existing = await prisma.stockLog.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) return res.status(404).json({ error: 'Log not found' });
    await prisma.stockLog.delete({ where: { id } });
    res.json({ message: 'Log deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

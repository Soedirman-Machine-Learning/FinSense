const prisma = require('../config/prisma');

// GET /products - semua produk milik user
exports.getProducts = async (req, res) => {
  try {
    const userId = req.userId;
    const products = await prisma.product.findMany({
      where: { user_id: userId },
      orderBy: { name: 'asc' },
    });
    // tambahkan status berdasarkan stok vs min_stock
    const enriched = products.map((p) => ({
      ...p,
      status: p.stock <= p.min_stock ? 'Menipis' : 'Aman',
    }));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// GET /products/:id - detail produk
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const product = await prisma.product.findFirst({
      where: { id, user_id: userId },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /products - tambah produk baru
exports.createProduct = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, sku, stock, unit, price, min_stock } = req.body;
    if (!name || !sku) {
      return res.status(400).json({ error: 'name and sku are required' });
    }
    const product = await prisma.product.create({
      data: {
        user_id: userId,
        name,
        sku,
        stock: stock ? parseInt(stock) : 0,
        unit: unit || null,
        price: price ? parseFloat(price) : null,
        min_stock: min_stock ? parseInt(min_stock) : 10,
      },
    });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);

    // Cek error duplicate key (kode P2002)
    if (err.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'Gagal menambah produk, SKU sudah terdaftar' });
    }

    res.status(500).json({ error: 'Gagal menambah produk' });
  }
};

// PUT /products/:id - update produk (nama, sku, harga, min_stok, dll)
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { name, sku, unit, price, min_stock } = req.body;

    const existing = await prisma.product.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (sku !== undefined) updateData.sku = sku;
    if (unit !== undefined) updateData.unit = unit;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (min_stock !== undefined) updateData.min_stock = parseInt(min_stock);

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// PATCH /products/:id/stock - khusus update stok (dengan log otomatis)
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { quantity, type, note } = req.body; // type: 'in' (tambah) atau 'out' (kurang)
    if (!quantity || !type) {
      return res.status(400).json({ error: 'quantity and type required' });
    }
    const product = await prisma.product.findFirst({
      where: { id, user_id: userId },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let newStock = product.stock;
    if (type === 'in') newStock += parseInt(quantity);
    else if (type === 'out') newStock -= parseInt(quantity);
    else return res.status(400).json({ error: 'type must be in or out' });

    if (newStock < 0)
      return res.status(400).json({ error: 'Stock cannot be negative' });

    // Gunakan transaction untuk update stok dan buat stock log
    const result = await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { stock: newStock },
      }),
      prisma.stockLog.create({
        data: {
          product_id: id,
          user_id: userId,
          type: type === 'in' ? 'in' : 'out',
          quantity: parseInt(quantity),
          note: note || null,
          operator: req.user?.full_name || 'system',
          status: 'completed',
        },
      }),
    ]);
    res.json({ message: 'Stock updated', product: result[0], log: result[1] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /products/:id - hapus produk
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const existing = await prisma.product.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

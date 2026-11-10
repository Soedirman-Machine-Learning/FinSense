const prisma = require('../config/prisma');

// Helper untuk update status overdue
const updateOverdueStatus = (debts) => {
  const now = new Date();
  return debts.map((debt) => {
    if (debt.status !== 'paid' && debt.due_date < now) {
      debt.status = 'overdue';
    }
    return debt;
  });
};

// GET /debts - semua hutang milik user
exports.getDebts = async (req, res) => {
  try {
    const userId = req.userId;
    let debts = await prisma.debt.findMany({
      where: { user_id: userId },
      include: { payments: true },
      orderBy: { due_date: 'asc' },
    });
    debts = updateOverdueStatus(debts);
    res.json(debts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// GET /debts/:id - detail hutang by id
exports.getDebtById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    let debt = await prisma.debt.findFirst({
      where: { id, user_id: userId },
      include: { payments: true },
    });
    if (!debt) {
      return res.status(404).json({ error: 'Debt not found' });
    }
    // Update status overdue jika perlu
    const now = new Date();
    if (debt.status !== 'paid' && debt.due_date < now) {
      debt = await prisma.debt.update({
        where: { id },
        data: { status: 'overdue' },
        include: { payments: true },
      });
    }
    res.json(debt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// POST /debts - tambah hutang baru
exports.createDebt = async (req, res) => {
  try {
    const userId = req.userId;
    const { customer_name, total_debt, due_date, note } = req.body;

    if (!customer_name || !total_debt || !due_date) {
      return res
        .status(400)
        .json({ error: 'customer_name, total_debt, due_date are required' });
    }

    const debt = await prisma.debt.create({
      data: {
        user_id: userId,
        customer_name,
        total_debt: parseFloat(total_debt),
        due_date: new Date(due_date),
        note: note || null,
        status: 'pending',
        paid_amount: 0,
      },
    });
    res.status(201).json(debt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /debts/:id - update hutang (edit)
exports.updateDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { customer_name, total_debt, due_date, status, note } = req.body;

    // Cek kepemilikan
    const existing = await prisma.debt.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Debt not found' });
    }

    // Siapkan data update
    const updateData = {};
    if (customer_name !== undefined) updateData.customer_name = customer_name;
    if (total_debt !== undefined)
      updateData.total_debt = parseFloat(total_debt);
    if (due_date !== undefined) updateData.due_date = new Date(due_date);
    if (status !== undefined) updateData.status = status;
    if (note !== undefined) updateData.note = note;

    // Jika status diubah menjadi paid, pastikan paid_amount = total_debt
    if (status === 'paid' && existing.paid_amount < existing.total_debt) {
      updateData.paid_amount = existing.total_debt;
    }

    const updated = await prisma.debt.update({
      where: { id },
      data: updateData,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// POST /debts/:id/pay - catat pembayaran (dan buat transaksi income)
exports.addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { amount, note } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const debt = await prisma.debt.findFirst({
      where: { id, user_id: userId },
    });
    if (!debt) return res.status(404).json({ error: 'Debt not found' });
    if (debt.status === 'paid')
      return res.status(400).json({ error: 'Debt already paid' });

    const paymentAmount = parseFloat(amount);
    const newPaid = debt.paid_amount + paymentAmount;
    let newStatus = debt.status;
    if (newPaid >= debt.total_debt) {
      newStatus = 'paid';
    } else if (newPaid > 0) {
      newStatus = 'partial';
    }

    // Ambil kategori "Pendapatan Lain" (sudah ada di seed)
    let category = await prisma.transactionCategory.findFirst({
      where: {
        name: 'Pendapatan Lain',
        type: 'income',
      },
    });
    // Fallback: jika tidak ada (misal seed belum jalan), cari kategori income apa pun
    if (!category) {
      category = await prisma.transactionCategory.findFirst({
        where: { type: 'income' },
      });
      if (!category) {
        throw new Error(
          'No income category found. Please seed TransactionCategory.',
        );
      }
    }

    const now = new Date();
    // Lakukan semua operasi dalam satu transaksi database
    const result = await prisma.$transaction(async (tx) => {
      // 1. Catat pembayaran hutang
      const payment = await tx.debtPayment.create({
        data: {
          debt_id: id,
          amount: paymentAmount,
          note: note || null,
        },
      });

      // 2. Update status hutang
      const updatedDebt = await tx.debt.update({
        where: { id },
        data: {
          paid_amount: newPaid,
          status: newStatus,
        },
      });

      // 3. Buat transaksi pendapatan (income) dengan kategori "Pendapatan Lain"
      const transaction = await tx.transaction.create({
        data: {
          user_id: userId,
          category_id: category.id,
          type: 'income',
          amount: paymentAmount,
          description: `Pembayaran hutang dari ${debt.customer_name}${note ? ` - ${note}` : ''}`,
          transaction_date: now,
          source: 'manual',
          is_anomaly: false,
        },
      });

      return { payment, updatedDebt, transaction };
    });

    res.json({
      message: 'Payment recorded and income transaction created',
      payment: result.payment,
      debt: result.updatedDebt,
      transaction: result.transaction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /debts/:id - hapus hutang
exports.deleteDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const existing = await prisma.debt.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) return res.status(404).json({ error: 'Debt not found' });

    await prisma.debt.delete({ where: { id } });
    res.json({ message: 'Debt deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

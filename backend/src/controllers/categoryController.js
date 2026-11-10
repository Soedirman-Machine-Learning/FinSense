const prisma = require('../config/prisma');

exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.transactionCategory.findMany({
      where: { parent_id: null },
      include: { children: true },
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

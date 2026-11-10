const prisma = require('../config/prisma');

exports.getUmkmProfile = async (req, res) => {
  try {
    const profile = await prisma.umkmProfile.findUnique({
      where: { user_id: req.userId },
    });
    res.json(profile || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createOrUpdateUmkmProfile = async (req, res) => {
  try {
    const {
      business_name,
      business_type,
      province,
      city,
      monthly_revenue_est,
      employee_count,
    } = req.body;
    const profile = await prisma.umkmProfile.upsert({
      where: { user_id: req.userId },
      update: {
        business_name,
        business_type,
        province,
        city,
        monthly_revenue_est,
        employee_count,
        onboarding_done: true,
      },
      create: {
        user_id: req.userId,
        business_name,
        business_type,
        province,
        city,
        monthly_revenue_est,
        employee_count,
        onboarding_done: true,
      },
    });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const Joi = require('joi');

// ==================== HELPER & CUSTOM ====================
const objectId = Joi.string().uuid({ version: 'uuidv4' }).optional();
const positiveNumber = Joi.number().positive().precision(2);
const integerPositive = Joi.number().integer().min(0);

// ==================== AUTH ====================
const emailSchema = Joi.string().email().required().messages({
  'string.email': 'Email tidak valid',
  'any.required': 'Email wajib diisi',
});
const passwordSchema = Joi.string().min(6).required().messages({
  'string.min': 'Password minimal 6 karakter',
});
const fullNameSchema = Joi.string().min(3).max(100).required();

const loginSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
});

const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: fullNameSchema,
});

const updateUserSchema = Joi.object({
  full_name: fullNameSchema,
  email: emailSchema.optional(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().uuid().required(),
});

const logoutSchema = Joi.object({
  refreshToken: Joi.string().uuid().optional(),
});

// ==================== UMKM PROFILE ====================
const umkmProfileSchema = Joi.object({
  business_name: Joi.string().min(2).max(200).optional().allow('', null),
  business_type: Joi.string().optional().allow('', null),
  province: Joi.string().optional().allow('', null),
  city: Joi.string().optional().allow('', null),
  monthly_revenue_est: Joi.number().positive().optional().allow(null),
  employee_count: Joi.number().integer().min(0).optional().allow(null),
});

// ==================== TRANSACTION ====================
const transactionCategoryId = Joi.number().integer().positive().required();
const transactionType = Joi.string().valid('income', 'expense').required();
const transactionAmount = Joi.number().positive().precision(2).required();
const transactionSource = Joi.string()
  .valid('manual', 'voice', 'ai')
  .default('manual');

// Schema untuk satu item transaksi
const transactionItemSchema = Joi.object({
  item_name: Joi.string().min(1).max(200).required(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().max(20).optional().allow('', null),
  unit_price: Joi.number().positive().precision(2).required(),
  total_price: Joi.number().positive().precision(2).optional(),
  category_id: Joi.number().integer().positive().optional().allow(null),
  product_id: Joi.string().uuid().optional().allow(null),
  ai_confidence: Joi.number().min(0).max(1).optional().allow(null),
});

const createTransactionSchema = Joi.object({
  category_id: transactionCategoryId,
  type: transactionType,
  amount: transactionAmount,
  description: Joi.string().max(255).optional().allow('', null),
  transaction_date: Joi.date()
    .iso()
    .default(() => new Date()),
  source: transactionSource,
  items: Joi.array().items(transactionItemSchema).optional().default([]),
});

const updateTransactionSchema = Joi.object({
  category_id: transactionCategoryId.optional(),
  type: transactionType.optional(),
  amount: transactionAmount.optional(),
  description: Joi.string().max(255).optional().allow('', null),
  transaction_date: Joi.date().iso().optional(),
  source: transactionSource.optional(),
  items: Joi.array().items(transactionItemSchema).optional(),
});

// ==================== PRODUCT / STOK ====================
const productName = Joi.string().min(1).max(200).required();
const productSku = Joi.string().max(50).required();
const productStock = Joi.number().integer().min(0).default(0);
const productPrice = Joi.number()
  .positive()
  .precision(2)
  .optional()
  .allow(null);
const productMinStock = Joi.number().integer().min(0).default(10);

const createProductSchema = Joi.object({
  name: productName,
  sku: productSku,
  stock: productStock,
  unit: Joi.string().max(20).optional().allow('', null),
  price: productPrice,
  min_stock: productMinStock,
});

const updateProductSchema = Joi.object({
  name: productName.optional(),
  sku: productSku.optional(),
  unit: Joi.string().max(20).optional().allow('', null),
  price: productPrice.optional(),
  min_stock: productMinStock.optional(),
});

const updateStockSchema = Joi.object({
  quantity: Joi.number().integer().positive().required(),
  type: Joi.string().valid('in', 'out').required(),
  note: Joi.string().max(255).optional().allow('', null),
});

// ==================== DEBT ====================
const customerName = Joi.string().min(1).max(200).required();
const totalDebt = Joi.number().positive().precision(2).required();
const dueDate = Joi.date().iso().greater('now').required().messages({
  'date.greater': 'Tanggal jatuh tempo harus lebih besar dari hari ini',
});
const debtStatus = Joi.string()
  .valid('pending', 'partial', 'paid', 'overdue')
  .default('pending');

const createDebtSchema = Joi.object({
  customer_name: customerName,
  total_debt: totalDebt,
  due_date: dueDate,
  note: Joi.string().max(255).optional().allow('', null),
});

const updateDebtSchema = Joi.object({
  customer_name: customerName.optional(),
  total_debt: totalDebt.optional(),
  due_date: dueDate.optional(),
  status: debtStatus.optional(),
  note: Joi.string().max(255).optional().allow('', null),
});

const addPaymentSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
  note: Joi.string().max(255).optional().allow('', null),
});

// ==================== STOCK LOG ====================
const stockLogType = Joi.string().valid('in', 'out', 'adjust').required();
const stockLogQuantity = Joi.number().integer().positive().required();
const stockLogOperator = Joi.string().max(100).default('system');
const stockLogStatus = Joi.string()
  .valid('completed', 'pending_audit')
  .default('completed');

const createStockLogSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  type: stockLogType,
  quantity: stockLogQuantity,
  note: Joi.string().max(255).optional().allow('', null),
  operator: stockLogOperator,
  status: stockLogStatus,
});

const updateStockLogSchema = Joi.object({
  status: stockLogStatus.optional(),
  note: Joi.string().max(255).optional().allow('', null),
});

// ==================== EXPORTS ====================
module.exports = {
  // Auth
  validateLogin: (data) => loginSchema.validate(data, { abortEarly: false }),
  validateRegister: (data) =>
    registerSchema.validate(data, { abortEarly: false }),
  validateUpdateUser: (data) =>
    updateUserSchema.validate(data, { abortEarly: false }),
  validateRefreshToken: (data) =>
    refreshTokenSchema.validate(data, { abortEarly: false }),
  validateLogout: (data) => logoutSchema.validate(data, { abortEarly: false }),

  // UMKM
  validateUmkmProfile: (data) =>
    umkmProfileSchema.validate(data, { abortEarly: false }),

  // Transaction
  validateCreateTransaction: (data) =>
    createTransactionSchema.validate(data, { abortEarly: false }),
  validateUpdateTransaction: (data) =>
    updateTransactionSchema.validate(data, { abortEarly: false }),

  // Product
  validateCreateProduct: (data) =>
    createProductSchema.validate(data, { abortEarly: false }),
  validateUpdateProduct: (data) =>
    updateProductSchema.validate(data, { abortEarly: false }),
  validateUpdateStock: (data) =>
    updateStockSchema.validate(data, { abortEarly: false }),

  // Debt
  validateCreateDebt: (data) =>
    createDebtSchema.validate(data, { abortEarly: false }),
  validateUpdateDebt: (data) =>
    updateDebtSchema.validate(data, { abortEarly: false }),
  validateAddPayment: (data) =>
    addPaymentSchema.validate(data, { abortEarly: false }),

  // Stock Log
  validateCreateStockLog: (data) =>
    createStockLogSchema.validate(data, { abortEarly: false }),
  validateUpdateStockLog: (data) =>
    updateStockLogSchema.validate(data, { abortEarly: false }),

  // POS
  validateCheckout: (data) =>
    checkoutSchema.validate(data, { abortEarly: false }),
};

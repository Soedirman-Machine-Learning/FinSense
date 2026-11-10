const express = require('express');
const auth = require('../middleware/auth');
const {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionById,
} = require('../controllers/transactionController');
const router = express.Router();
const {
  validateCreateTransaction,
  validateUpdateTransaction,
} = require('../utils/validation');
const validate = require('../middleware/validate');

router.use(auth);
router.get('/', getTransactions);
router.get('/:id', getTransactionById);
router.post('/', validate(validateCreateTransaction), createTransaction);
router.put('/:id', validate(validateUpdateTransaction), updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;

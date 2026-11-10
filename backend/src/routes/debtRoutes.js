const express = require('express');
const router = express.Router();
const debtController = require('../controllers/debtController');
const {
  validateCreateDebt,
  validateUpdateDebt,
  validateAddPayment,
} = require('../utils/validation');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', debtController.getDebts);
router.get('/:id', debtController.getDebtById);
router.post('/', validate(validateCreateDebt), debtController.createDebt);
router.put('/:id', validate(validateUpdateDebt), debtController.updateDebt);
router.post(
  '/:id/pay',
  validate(validateAddPayment),
  debtController.addPayment,
);
router.delete('/:id', debtController.deleteDebt);

module.exports = router;

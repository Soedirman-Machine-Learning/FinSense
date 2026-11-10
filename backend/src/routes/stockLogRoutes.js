const express = require('express');
const auth = require('../middleware/auth');
const stockLogController = require('../controllers/stockLogController');
const router = express.Router();
const {
  validateCreateStockLog,
  validateUpdateStockLog,
} = require('../utils/validation');
const validate = require('../middleware/validate');

router.use(auth);
router.get('/', stockLogController.getStockLogs);
router.post(
  '/',
  validate(validateCreateStockLog),
  stockLogController.createStockLog,
);
router.put(
  '/:id',
  validate(validateUpdateStockLog),
  stockLogController.updateStockLog,
);
router.delete('/:id', stockLogController.deleteStockLog);

module.exports = router;

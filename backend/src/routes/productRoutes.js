const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const productsController = require('../controllers/productController');
const {
  validateCreateProduct,
  validateUpdateProduct,
  validateUpdateStock,
} = require('../utils/validation');
const validate = require('../middleware/validate');

router.use(auth);
router.post(
  '/',
  validate(validateCreateProduct),
  productsController.createProduct,
);
router.put(
  '/:id',
  validate(validateUpdateProduct),
  productsController.updateProduct,
);
router.patch(
  '/:id/stock',
  validate(validateUpdateStock),
  productsController.updateStock,
);
router.get('/', productsController.getProducts);
router.get('/:id', productsController.getProductById);
router.delete('/:id', productsController.deleteProduct);

module.exports = router;

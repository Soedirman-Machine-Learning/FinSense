const express = require('express');
const auth = require('../middleware/auth');
const { getCategories } = require('../controllers/categoryController');
const router = express.Router();

router.use(auth);
router.get('/', getCategories);

module.exports = router;

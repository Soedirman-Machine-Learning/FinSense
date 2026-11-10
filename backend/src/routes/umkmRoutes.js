const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const {
  getUmkmProfile,
  createOrUpdateUmkmProfile,
} = require('../controllers/umkmController');
const { validateUmkmProfile } = require('../utils/validation');
const validate = require('../middleware/validate');

router.use(auth);
router.get('/', getUmkmProfile);
router.post('/', validate(validateUmkmProfile), createOrUpdateUmkmProfile);

module.exports = router;

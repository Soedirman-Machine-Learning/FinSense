const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const {
  validateRegister,
  validateLogin,
  validateUpdateUser,
  validateRefreshToken,
  validateLogout,
} = require('../utils/validation');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');

router.post('/register', validate(validateRegister), authController.register);
router.post('/login', validate(validateLogin), authController.login);
router.put(
  '/profile',
  auth,
  validate(validateUpdateUser),
  authController.updateProfile,
);
router.get('/profile', auth, authController.getProfile);
router.post(
  '/refresh-token',
  validate(validateRefreshToken),
  authController.refreshToken,
);
router.post('/logout', validate(validateLogout), authController.logout);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;

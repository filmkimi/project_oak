const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// กำหนด Endpoint สำหรับ Register และ Login
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/password-reset/request-otp', authController.requestPasswordResetOtp);
router.post('/password-reset/confirm', authController.resetPasswordWithOtp);

module.exports = router;
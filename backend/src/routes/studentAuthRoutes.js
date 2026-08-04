const express = require('express');
const router = express.Router();
const {
  registerStudent,
  verifyOTP,
  resendOTP,
  loginStudent,
  getStudentProfile,
  forgotPassword,
  resetPassword,
  changePassword,
} = require('../controllers/studentAuthController');
const { verifyStudent } = require('../middleware/authMiddleware');
const { authLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');

// Rate limited public auth routes
router.post('/signup', authLimiter, registerStudent);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/resend-otp', authLimiter, resendOTP);
router.post('/login', authLimiter, loginStudent);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

// Authenticated student routes
router.get('/me', verifyStudent, getStudentProfile);
router.post('/change-password', verifyStudent, changePassword);

module.exports = router;

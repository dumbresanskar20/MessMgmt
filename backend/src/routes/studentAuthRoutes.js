const express = require('express');
const router = express.Router();
const {
  registerStudent,
  verifyOTP,
  resendOTP,
  loginStudent,
  getStudentProfile,
} = require('../controllers/studentAuthController');
const { verifyStudent } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Rate limited public auth routes
router.post('/signup', authLimiter, registerStudent);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/resend-otp', authLimiter, resendOTP);
router.post('/login', authLimiter, loginStudent);

// Authenticated student route
router.get('/me', verifyStudent, getStudentProfile);

module.exports = router;

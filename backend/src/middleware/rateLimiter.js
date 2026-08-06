const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many API requests from this IP, please try again later.',
  },
});

// Forgot password rate limiter (3 requests per hour max, keyed by email)
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit to 3 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email ? req.body.email.toLowerCase().trim() : req.ip;
  },
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again after an hour.',
  },
});

// Resend OTP rate limiter (3 requests per 15 minutes max, keyed by email)
const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit to 3 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email ? req.body.email.toLowerCase().trim() : req.ip;
  },
  message: {
    success: false,
    message: 'Too many OTP resend attempts. Please try again after 15 minutes.',
  },
});

// Stricter rate limiter for owner endpoints
const ownerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many developer panel attempts, please try again after 15 minutes.',
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
  forgotPasswordLimiter,
  resendOtpLimiter,
  ownerLimiter,
};


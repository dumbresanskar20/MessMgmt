const express = require('express');
const router = express.Router();
const {
  loginAdmin,
  createStaffAccount,
  setStaffPassword,
  listAdminAccounts,
  toggleStaffStatus,
  deleteStaffAccount,
  getAdminProfile,
} = require('../controllers/adminAuthController');
const { verifyAdmin, requireRole } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Public admin auth endpoints
router.post('/login', authLimiter, loginAdmin);
router.post('/set-password', setStaffPassword);

// Profile endpoint
router.get('/me', verifyAdmin, getAdminProfile);

// Super Admin management endpoints (Strict RBAC)
router.get('/staff', verifyAdmin, requireRole('super_admin'), listAdminAccounts);
router.post('/staff', verifyAdmin, requireRole('super_admin'), createStaffAccount);
router.patch('/staff/:id/toggle', verifyAdmin, requireRole('super_admin'), toggleStaffStatus);
router.delete('/staff/:id', verifyAdmin, requireRole('super_admin'), deleteStaffAccount);

module.exports = router;

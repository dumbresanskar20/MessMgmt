const express = require('express');
const router = express.Router();
const {
  getSubscriptionStatusDetails,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  handleDevRazorpayWebhook,
  forceExpireSubscriptionTest,
} = require('../controllers/subscriptionController');
const { verifyAdmin, requireRole } = require('../middleware/authMiddleware');

// Public/Authenticated status check
router.get('/status', getSubscriptionStatusDetails);

// Developer Razorpay Webhook (standalone route handling)
router.post('/webhook', handleDevRazorpayWebhook);

// Super Admin Only Renewal Operations
router.post('/create-order', verifyAdmin, requireRole('super_admin'), createSubscriptionOrder);
router.post('/verify-payment', verifyAdmin, requireRole('super_admin'), verifySubscriptionPayment);
router.post('/expire-test', verifyAdmin, requireRole('super_admin'), forceExpireSubscriptionTest);

module.exports = router;

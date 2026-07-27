const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  requestCounterPaymentOrder,
  getPendingCounterOrders,
  markCounterOrderPaid,
  verifyPaymentAndFulfill,
  razorpayWebhook,
  getStudentOrders,
  getKitchenOrders,
  getKitchenOrderCounts,
  updateOrderStatus,
} = require('../controllers/orderController');
const { verifyStudent, verifyAdmin } = require('../middleware/authMiddleware');

// Student endpoints (STRICT STUDENT JWT ENFORCED)
router.post('/create-razorpay-order', verifyStudent, createRazorpayOrder);
router.post('/request-counter-order', verifyStudent, requestCounterPaymentOrder);
router.post('/verify-payment', verifyStudent, verifyPaymentAndFulfill);
router.get('/my-orders', verifyStudent, getStudentOrders);

// Razorpay Webhook Endpoint
router.post('/webhook', razorpayWebhook);

// Kitchen / Admin endpoints
router.get('/kitchen-orders', verifyAdmin, getKitchenOrders);
router.get('/kitchen-order-counts', verifyAdmin, getKitchenOrderCounts);
router.get('/pending-counter-payments', verifyAdmin, getPendingCounterOrders);
router.patch('/mark-counter-paid/:id', verifyAdmin, markCounterOrderPaid);
router.patch('/status/:id', verifyAdmin, updateOrderStatus);

module.exports = router;

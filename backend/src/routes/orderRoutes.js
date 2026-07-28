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
  getAdminOrderHistory,
  getTodayIncome,
  getIncomeHistory,
} = require('../controllers/orderController');
const { verifyStudent, verifyAdmin, requireRole } = require('../middleware/authMiddleware');

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

// Admin Order History (Accessible to both super_admin and staff)
router.get('/history', verifyAdmin, getAdminOrderHistory);
router.get('/admin/orders/history', verifyAdmin, getAdminOrderHistory);

// Super Admin Income Endpoints (Strictly restricted to super_admin role via requireRole)
router.get('/income/today', verifyAdmin, requireRole('super_admin'), getTodayIncome);
router.get('/admin/income/today', verifyAdmin, requireRole('super_admin'), getTodayIncome);
router.get('/income/history', verifyAdmin, requireRole('super_admin'), getIncomeHistory);
router.get('/admin/income/history', verifyAdmin, requireRole('super_admin'), getIncomeHistory);

module.exports = router;

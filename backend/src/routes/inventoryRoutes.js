const express = require('express');
const router = express.Router();
const {
  createInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
  restockInventoryItem,
  getInventoryItemLogs,
  getInventoryDashboardSummary,
} = require('../controllers/inventoryController');
const { verifyAdmin } = require('../middleware/authMiddleware');

// All inventory endpoints require Admin verification (staff/super_admin)
router.use(verifyAdmin);

// Dashboard summary endpoint
router.get('/summary', getInventoryDashboardSummary);

// Base CRUD endpoints
router.get('/', listInventoryItems);
router.post('/', createInventoryItem);
router.put('/:id', updateInventoryItem);
router.delete('/:id', deleteInventoryItem);

// Restock & Logs endpoints
router.post('/:id/restock', restockInventoryItem);
router.get('/:id/logs', getInventoryItemLogs);

module.exports = router;

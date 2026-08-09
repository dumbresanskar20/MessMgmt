const express = require('express');
const router = express.Router();
const {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMealWindows,
  updateMealWindow,
  getMenuItemRecipe,
} = require('../controllers/menuController');
const { verifyAdmin } = require('../middleware/authMiddleware');
const { handleImageUpload } = require('../middleware/upload');

// Public endpoints
router.get('/items', getMenuItems);
router.get('/admin/menu-items', getMenuItems);
router.get('/windows', getMealWindows);
router.get('/types', getMealWindows);

// Admin-only endpoints for menu items with Cloudinary image upload middleware
router.post('/items', verifyAdmin, handleImageUpload('image'), createMenuItem);
router.post('/admin/menu-items', verifyAdmin, handleImageUpload('image'), createMenuItem);
router.put('/items/:id', verifyAdmin, handleImageUpload('image'), updateMenuItem);
router.patch('/items/:id', verifyAdmin, handleImageUpload('image'), updateMenuItem);
router.put('/admin/menu-items/:id', verifyAdmin, handleImageUpload('image'), updateMenuItem);
router.patch('/admin/menu-items/:id', verifyAdmin, handleImageUpload('image'), updateMenuItem);
router.delete('/items/:id', verifyAdmin, deleteMenuItem);
router.delete('/admin/menu-items/:id', verifyAdmin, deleteMenuItem);
router.get('/items/:id/recipe', verifyAdmin, getMenuItemRecipe);
router.get('/admin/menu-items/:id/recipe', verifyAdmin, getMenuItemRecipe);

// Admin-only endpoint for meal timings
router.put('/windows/:meal_type', verifyAdmin, updateMealWindow);

module.exports = router;

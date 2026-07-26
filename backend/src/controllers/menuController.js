const MenuItem = require('../models/MenuItem');
const MealWindow = require('../models/MealWindow');
const cloudinary = require('../config/cloudinary');

const getCurrentTimeHHMM = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const format12HourTime = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hours12 = h % 12 || 12;
  const minutes = String(m || 0).padStart(2, '0');
  return `${hours12}:${minutes} ${period}`;
};

const computeMealStatus = (w, currentTime = getCurrentTimeHHMM()) => {
  const isActive = w.is_active !== false;
  let isCurrentlyOpen = false;

  if (isActive) {
    if (w.is_full_day === true) {
      isCurrentlyOpen = true; // Full day meal types skip time comparison entirely
    } else {
      isCurrentlyOpen = Boolean(
        w.start_time && w.end_time && currentTime >= w.start_time && currentTime <= w.end_time
      );
    }
  }

  return {
    _id: w._id,
    meal_type: w.meal_type,
    start_time: w.start_time || '08:00',
    end_time: w.end_time || '20:00',
    formatted_start_time: format12HourTime(w.start_time || '08:00'),
    formatted_end_time: format12HourTime(w.end_time || '20:00'),
    is_active: isActive,
    is_full_day: Boolean(w.is_full_day),
    is_currently_open: isCurrentlyOpen,
  };
};

// Get all menu items (Students & Admin)
const getMenuItems = async (req, res) => {
  try {
    const { meal_type, active_only } = req.query;

    const windows = await MealWindow.find();
    const currentTime = getCurrentTimeHHMM();
    
    // Map window status for all meal types
    const windowMap = {};
    windows.forEach(w => {
      windowMap[w.meal_type.toLowerCase()] = computeMealStatus(w, currentTime);
    });

    const activeTypes = ['breakfast', 'lunch', 'snacks', 'dinner'].filter(
      t => windowMap[t] ? windowMap[t].is_active : true
    );

    const filter = {};

    if (meal_type) {
      const targetType = meal_type.toLowerCase();
      const status = windowMap[targetType] || { is_active: true, is_currently_open: true };

      if (!status.is_active) {
        return res.status(200).json({
          success: true,
          count: 0,
          items: [],
          is_active: false,
          is_currently_open: false,
          message: `The meal type '${targetType}' is currently not offered by Canteen Management.`,
        });
      }

      filter.meal_type = targetType;

      if (active_only === 'true') {
        filter.is_active = true;
      }

      const items = await MenuItem.find(filter).sort({ created_at: -1 });

      return res.status(200).json({
        success: true,
        count: items.length,
        items,
        is_active: status.is_active,
        is_currently_open: status.is_currently_open,
        meal_window: status,
      });
    } else {
      filter.meal_type = { $in: activeTypes };
      if (active_only === 'true') {
        filter.is_active = true;
      }

      const items = await MenuItem.find(filter).sort({ created_at: -1 });

      return res.status(200).json({
        success: true,
        count: items.length,
        items,
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching menu items.' });
  }
};

// Create a new menu item (Admin)
const createMenuItem = async (req, res) => {
  try {
    const { name, image_url, meal_type, price, description, is_active } = req.body;

    if (!name || price === undefined || !meal_type) {
      return res.status(400).json({ success: false, message: 'Name, price, and meal_type are required fields.' });
    }

    let finalImageUrl = image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
    let cloudinaryPublicId = null;

    if (req.file) {
      finalImageUrl = req.file.path || req.file.secure_url;
      cloudinaryPublicId = req.file.filename || req.file.public_id;
    }

    const item = new MenuItem({
      name: name.trim(),
      image_url: finalImageUrl,
      cloudinary_public_id: cloudinaryPublicId,
      meal_type: meal_type.toLowerCase(),
      price: Number(price),
      description: description || '',
      is_active: is_active !== undefined ? (is_active === 'true' || is_active === true) : true,
    });

    await item.save();

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully!',
      item,
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error creating menu item.' });
  }
};

// Update menu item or toggle active state (Admin)
const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    const existingItem = await MenuItem.findById(id);
    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    if (updates.meal_type) {
      updates.meal_type = updates.meal_type.toLowerCase();
    }
    if (updates.price !== undefined) {
      updates.price = Number(updates.price);
    }
    if (updates.is_active !== undefined) {
      updates.is_active = updates.is_active === 'true' || updates.is_active === true;
    }

    if (req.file) {
      const newImageUrl = req.file.path || req.file.secure_url;
      const newPublicId = req.file.filename || req.file.public_id;

      if (existingItem.cloudinary_public_id) {
        try {
          await cloudinary.uploader.destroy(existingItem.cloudinary_public_id);
        } catch (destroyErr) {
          console.warn(`[Cloudinary] Failed to delete old image: ${destroyErr.message}`);
        }
      }

      updates.image_url = newImageUrl;
      updates.cloudinary_public_id = newPublicId;
    }

    const item = await MenuItem.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

    return res.status(200).json({
      success: true,
      message: 'Menu item updated successfully.',
      item,
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return res.status(500).json({ success: false, message: 'Error updating menu item.' });
  }
};

// Delete menu item (Admin)
const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findById(id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    if (item.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(item.cloudinary_public_id);
      } catch (destroyErr) {
        console.warn(`[Cloudinary] Failed to delete image: ${destroyErr.message}`);
      }
    }

    await MenuItem.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return res.status(500).json({ success: false, message: 'Error deleting menu item.' });
  }
};

// Get Meal Timings / Windows
const getMealWindows = async (req, res) => {
  try {
    let windows = await MealWindow.find().sort({ meal_type: 1 });

    if (windows.length === 0) {
      const defaultWindows = [
        { meal_type: 'breakfast', start_time: '07:30', end_time: '10:00', is_active: true, is_full_day: false },
        { meal_type: 'lunch', start_time: '12:00', end_time: '14:30', is_active: true, is_full_day: false },
        { meal_type: 'snacks', start_time: '16:30', end_time: '18:00', is_active: true, is_full_day: false },
        { meal_type: 'dinner', start_time: '19:30', end_time: '21:30', is_active: true, is_full_day: false },
      ];
      windows = await MealWindow.insertMany(defaultWindows);
    }

    const currentTime = getCurrentTimeHHMM();
    const formattedWindows = windows.map((w) => computeMealStatus(w, currentTime));

    return res.status(200).json({
      success: true,
      windows: formattedWindows,
      current_time: currentTime,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching meal timings.' });
  }
};

// Update Meal Window Timing (Admin)
const updateMealWindow = async (req, res) => {
  try {
    const { meal_type } = req.params;
    const { start_time, end_time, is_active, is_full_day } = req.body;

    const updates = {};
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (is_active !== undefined) updates.is_active = is_active === true || is_active === 'true';
    if (is_full_day !== undefined) updates.is_full_day = is_full_day === true || is_full_day === 'true';

    const window = await MealWindow.findOneAndUpdate(
      { meal_type: meal_type.toLowerCase() },
      updates,
      { new: true, upsert: true }
    );

    const formatted = computeMealStatus(window);

    return res.status(200).json({
      success: true,
      message: `Meal window for ${meal_type} updated successfully.`,
      window: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating meal window.' });
  }
};

module.exports = {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMealWindows,
  updateMealWindow,
  computeMealStatus,
};

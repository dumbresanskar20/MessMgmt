const prisma = require('../database/prisma');
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
      isCurrentlyOpen = true;
    } else {
      isCurrentlyOpen = Boolean(
        w.start_time && w.end_time && currentTime >= w.start_time && currentTime <= w.end_time
      );
    }
  }

  return {
    _id: w.id || w._id,
    id: w.id || w._id,
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

// Helper: add _id alias to a Prisma record
const withId = (record) => ({ ...record, _id: record.id });

// Get all menu items (Students & Admin)
const getMenuItems = async (req, res) => {
  try {
    const { meal_type, active_only } = req.query;
    const isStudentFetch = active_only === 'true';

    const windows = await prisma.mealWindow.findMany();
    const currentTime = getCurrentTimeHHMM();

    const windowMap = {};
    windows.forEach((w) => {
      windowMap[w.meal_type.toLowerCase()] = computeMealStatus(w, currentTime);
    });

    const activeTypes = ['breakfast', 'lunch', 'snacks', 'dinner'].filter(
      (t) => (windowMap[t] ? windowMap[t].is_active : true)
    );

    if (meal_type) {
      const targetType = meal_type.toLowerCase();
      const status = windowMap[targetType] || { is_active: true, is_currently_open: true };

      if (isStudentFetch && !status.is_active) {
        return res.status(200).json({
          success: true,
          count: 0,
          items: [],
          is_active: false,
          is_currently_open: false,
          message: `The meal type '${targetType}' is currently not offered by Canteen Management.`,
        });
      }

      const where = { meal_type: targetType };
      if (isStudentFetch) where.is_active = true;

      const items = await prisma.menuItem.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });

      return res.status(200).json({
        success: true,
        count: items.length,
        items: items.map(withId),
        is_active: status.is_active,
        is_currently_open: status.is_currently_open,
        meal_window: status,
      });
    } else {
      const where = {};
      if (isStudentFetch) {
        where.meal_type = { in: activeTypes };
        where.is_active = true;
      }

      const items = await prisma.menuItem.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });

      return res.status(200).json({
        success: true,
        count: items.length,
        items: items.map(withId),
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

    let finalImageUrl =
      image_url ||
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
    let cloudinaryPublicId = null;

    if (req.file) {
      finalImageUrl = req.file.path || req.file.secure_url;
      cloudinaryPublicId = req.file.filename || req.file.public_id || null;
    }

    let parsedIsActive = true;
    if (is_active !== undefined) {
      if (typeof is_active === 'string') {
        parsedIsActive = is_active.toLowerCase() === 'true' || is_active === '1';
      } else {
        parsedIsActive = Boolean(is_active);
      }
    }

    const item = await prisma.menuItem.create({
      data: {
        name: name.trim(),
        image_url: finalImageUrl,
        cloudinary_public_id: cloudinaryPublicId,
        meal_type: meal_type.toLowerCase(),
        price: Number(price),
        description: description || '',
        is_active: parsedIsActive,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully!',
      item: withId(item),
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
    const targetId = parseInt(id, 10);
    const updates = { ...req.body };

    const existingItem = await prisma.menuItem.findUnique({ where: { id: targetId } });
    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    if (updates.meal_type) updates.meal_type = updates.meal_type.toLowerCase();
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.is_active !== undefined) {
      if (typeof updates.is_active === 'string') {
        updates.is_active = updates.is_active.toLowerCase() === 'true' || updates.is_active === '1';
      } else {
        updates.is_active = Boolean(updates.is_active);
      }
    }

    if (req.file) {
      const newImageUrl = req.file.path || req.file.secure_url;
      const newPublicId = req.file.filename || req.file.public_id || null;

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

    // Remove fields that shouldn't be passed directly to Prisma update
    delete updates.id;
    delete updates._id;

    const item = await prisma.menuItem.update({
      where: { id: targetId },
      data: updates,
    });

    return res.status(200).json({
      success: true,
      message: 'Menu item updated successfully.',
      item: withId(item),
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
    const targetId = parseInt(id, 10);

    const item = await prisma.menuItem.findUnique({ where: { id: targetId } });
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

    await prisma.menuItem.delete({ where: { id: targetId } });

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
    let windows = await prisma.mealWindow.findMany({ orderBy: { meal_type: 'asc' } });

    if (windows.length === 0) {
      const defaultWindows = [
        { meal_type: 'breakfast', start_time: '07:30', end_time: '10:00', is_active: true, is_full_day: false },
        { meal_type: 'lunch', start_time: '12:00', end_time: '14:30', is_active: true, is_full_day: false },
        { meal_type: 'snacks', start_time: '16:30', end_time: '18:00', is_active: true, is_full_day: false },
        { meal_type: 'dinner', start_time: '19:30', end_time: '21:30', is_active: true, is_full_day: false },
      ];
      await prisma.mealWindow.createMany({ data: defaultWindows });
      windows = await prisma.mealWindow.findMany({ orderBy: { meal_type: 'asc' } });
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

    const updateData = {};
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (is_active !== undefined) updateData.is_active = is_active === true || is_active === 'true';
    if (is_full_day !== undefined) updateData.is_full_day = is_full_day === true || is_full_day === 'true';

    const cleanMealType = meal_type.toLowerCase();

    const window = await prisma.mealWindow.upsert({
      where: { meal_type: cleanMealType },
      update: updateData,
      create: {
        meal_type: cleanMealType,
        start_time: start_time || '08:00',
        end_time: end_time || '20:00',
        is_active: updateData.is_active !== undefined ? updateData.is_active : true,
        is_full_day: updateData.is_full_day !== undefined ? updateData.is_full_day : false,
      },
    });

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

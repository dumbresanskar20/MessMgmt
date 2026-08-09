const prisma = require('../database/prisma');

// Helper to cast decimal properties to float/number for JSON response
const shapeItem = (item) => {
  if (!item) return null;
  return {
    ...item,
    quantity_in_stock: Number(item.quantity_in_stock),
    low_stock_threshold: Number(item.low_stock_threshold),
  };
};

const shapeLog = (log) => {
  if (!log) return null;
  return {
    ...log,
    quantity_changed: Number(log.quantity_changed),
    admin_user: log.admin_user ? { id: log.admin_user.id, username: log.admin_user.username } : null,
    order: log.order ? { id: log.order.id, token_number: log.order.token_number } : null,
  };
};

// 1. Create Inventory Item
const createInventoryItem = async (req, res) => {
  try {
    const { name, unit, quantity_in_stock, low_stock_threshold } = req.body;

    if (!name || !unit || quantity_in_stock === undefined || low_stock_threshold === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, unit, quantity_in_stock, and low_stock_threshold are required.',
      });
    }

    const validUnits = ['kg', 'g', 'litre', 'ml', 'piece', 'packet'];
    if (!validUnits.includes(unit)) {
      return res.status(400).json({
        success: false,
        message: `Invalid unit. Allowed units: ${validUnits.join(', ')}`,
      });
    }

    // Case-insensitive duplicate name check
    const allItems = await prisma.inventoryItem.findMany({
      select: { name: true },
    });
    const duplicate = allItems.find((i) => i.name.toLowerCase().trim() === name.trim().toLowerCase());
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `${name.trim()} already exists in inventory — did you mean to restock it instead?`,
      });
    }

    // Atomic generate unique_inventory_id (INV-0001)
    const counter = await prisma.inventoryCounter.upsert({
      where: { id: 1 },
      update: { last_value: { increment: 1 } },
      create: { id: 1, last_value: 1 },
    });
    const uniqueId = `INV-${String(counter.last_value).padStart(4, '0')}`;

    const newItem = await prisma.inventoryItem.create({
      data: {
        unique_inventory_id: uniqueId,
        name: name.trim(),
        unit,
        quantity_in_stock: Number(quantity_in_stock),
        low_stock_threshold: Number(low_stock_threshold),
        is_active: true,
      },
    });

    // Write initial log if stock > 0
    if (Number(quantity_in_stock) > 0) {
      await prisma.inventoryLog.create({
        data: {
          inventory_item_id: newItem.id,
          action_type: 'restock',
          quantity_changed: Number(quantity_in_stock),
          admin_user_id: req.adminId,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Inventory item created successfully!',
      item: shapeItem(newItem),
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to create inventory item.' });
  }
};

// 2. List Inventory Items (Paginated & Searchable)
const listInventoryItems = async (req, res) => {
  try {
    const { search, is_active, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { unique_inventory_id: { contains: search } },
      ];
    }

    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    const totalCount = await prisma.inventoryItem.count({ where });
    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limitNum,
    });

    return res.status(200).json({
      success: true,
      count: totalCount,
      page: pageNum,
      pages: Math.ceil(totalCount / limitNum),
      items: items.map(shapeItem),
    });
  } catch (error) {
    console.error('Error listing inventory items:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve inventory items.' });
  }
};

// 3. Update Inventory Item
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);
    const updates = { ...req.body };

    const existing = await prisma.inventoryItem.findUnique({ where: { id: targetId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }

    if (updates.unit) {
      const validUnits = ['kg', 'g', 'litre', 'ml', 'piece', 'packet'];
      if (!validUnits.includes(updates.unit)) {
        return res.status(400).json({ success: false, message: 'Invalid unit.' });
      }
    }

    // Prepare prisma update data
    const data = {};
    if (updates.name !== undefined) data.name = updates.name.trim();
    if (updates.unit !== undefined) data.unit = updates.unit;
    if (updates.quantity_in_stock !== undefined) data.quantity_in_stock = Number(updates.quantity_in_stock);
    if (updates.low_stock_threshold !== undefined) data.low_stock_threshold = Number(updates.low_stock_threshold);
    if (updates.is_active !== undefined) {
      if (typeof updates.is_active === 'string') {
        data.is_active = updates.is_active === 'true';
      } else {
        data.is_active = Boolean(updates.is_active);
      }
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: targetId },
      data,
    });

    // Log update if quantity changed manually
    if (updates.quantity_in_stock !== undefined) {
      const diff = Number(updates.quantity_in_stock) - Number(existing.quantity_in_stock);
      if (diff !== 0) {
        await prisma.inventoryLog.create({
          data: {
            inventory_item_id: targetId,
            action_type: diff > 0 ? 'restock' : 'deduction',
            quantity_changed: diff,
            admin_user_id: req.adminId,
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Inventory item updated successfully.',
      item: shapeItem(updated),
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to update inventory item.' });
  }
};

// 4. Soft Delete (is_active: false)
const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const existing = await prisma.inventoryItem.findUnique({ where: { id: targetId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }

    await prisma.inventoryItem.update({
      where: { id: targetId },
      data: { is_active: false },
    });

    return res.status(200).json({
      success: true,
      message: 'Inventory item soft-deleted successfully (marked inactive).',
    });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete inventory item.' });
  }
};

// 5. Restock Item (Add stock)
const restockInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);
    const { quantity } = req.body;

    const amount = Number(quantity);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'A valid positive restock quantity is required.' });
    }

    const existing = await prisma.inventoryItem.findUnique({ where: { id: targetId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }

    // Atomic update stock
    const updated = await prisma.inventoryItem.update({
      where: { id: targetId },
      data: {
        quantity_in_stock: { increment: amount },
      },
    });

    // Log restock event
    await prisma.inventoryLog.create({
      data: {
        inventory_item_id: targetId,
        action_type: 'restock',
        quantity_changed: amount,
        admin_user_id: req.adminId,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Restocked ${amount} ${existing.unit} successfully!`,
      item: shapeItem(updated),
    });
  } catch (error) {
    console.error('Error restocking inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to restock inventory item.' });
  }
};

// 6. Get Item Logs / Audit history
const getInventoryItemLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id, 10);

    const logs = await prisma.inventoryLog.findMany({
      where: { inventory_item_id: targetId },
      orderBy: { created_at: 'desc' },
      include: {
        admin_user: { select: { id: true, username: true } },
        order: { select: { id: true, token_number: true } },
      },
      take: 50,
    });

    return res.status(200).json({
      success: true,
      logs: logs.map(shapeLog),
    });
  } catch (error) {
    console.error('Error fetching inventory item logs:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve logs.' });
  }
};

// 7. Get Inventory Dashboard Summary (Alerts + Stats + Recent Logs)
const getInventoryDashboardSummary = async (req, res) => {
  try {
    const totalItems = await prisma.inventoryItem.count();
    const activeItems = await prisma.inventoryItem.count({ where: { is_active: true } });

    // Out of stock level
    const outOfStockItems = await prisma.inventoryItem.findMany({
      where: { quantity_in_stock: { lte: 0 }, is_active: true },
    });

    // Low stock level (lte threshold and gte 0.001)
    const allActiveItems = await prisma.inventoryItem.findMany({
      where: { is_active: true },
    });

    const lowStockItems = allActiveItems.filter((item) => {
      const stock = Number(item.quantity_in_stock);
      const threshold = Number(item.low_stock_threshold);
      return stock <= threshold && stock > 0;
    });

    const outOfStockCount = outOfStockItems.length;
    const lowStockCount = lowStockItems.length;

    // Recent logs (take 15)
    const recentLogs = await prisma.inventoryLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 15,
      include: {
        inventory_item: { select: { name: true, unit: true, unique_inventory_id: true } },
        admin_user: { select: { id: true, username: true } },
        order: { select: { id: true, token_number: true } },
      },
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalItems,
        activeItems,
        outOfStockCount,
        lowStockCount,
      },
      lowStockItems: lowStockItems.map(shapeItem),
      outOfStockItems: outOfStockItems.map(shapeItem),
      recentLogs: recentLogs.map((log) => ({
        ...shapeLog(log),
        inventory_item: log.inventory_item,
      })),
    });
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard summary.' });
  }
};

module.exports = {
  createInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
  restockInventoryItem,
  getInventoryItemLogs,
  getInventoryDashboardSummary,
};

/**
 * CANTEEN RAZORPAY ACCOUNT ONLY - Used for Student Meal Payments
 * ───────────────────────────────────────────────────────────────
 * This controller handles student meal payments (student -> canteen).
 * Uses RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET.
 * NEVER touch Subscription table in this controller.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const { generateTokenNumber } = require('../services/tokenGenerator');
const { computeMealStatus } = require('./menuController');

// Initialize Razorpay SDK instance safely
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    console.warn('[Razorpay] Warning: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured!');
  }
  return new Razorpay({
    key_id: key_id || 'rzp_test_YourKeyIdHere',
    key_secret: key_secret || 'YourKeySecretHere',
  });
};

// Helper: add _id alias to order object and reshape items/student for frontend compatibility
const shapeOrder = (order) => {
  return {
    ...order,
    _id: order.id,
    total_amount: Number(order.total_amount),
    items: (order.items || []).map((it) => ({
      ...it,
      _id: it.id,
      price: Number(it.price),
    })),
    // student_id nested object matches Mongoose .populate() shape
    student_id: order.student
      ? { _id: order.student.id, id: order.student.id, name: order.student.name, roll_no: order.student.roll_no, email: order.student.email }
      : order.student_id,
    student: undefined,
  };
};

// Create Razorpay Order (STRICT STUDENT JWT ENFORCED VIA verifyStudent MIDDLEWARE)
const createRazorpayOrder = async (req, res) => {
  try {
    const { items, meal_type } = req.body;
    const studentId = req.studentId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required.' });
    }

    if (!meal_type || !['breakfast', 'lunch', 'dinner', 'snacks'].includes(meal_type.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Valid meal_type is required.' });
    }

    const targetMealType = meal_type.toLowerCase();

    // Check MealWindow status: Must be active and currently open for ordering
    const windowDoc = await prisma.mealWindow.findUnique({ where: { meal_type: targetMealType } });
    if (windowDoc) {
      const windowStatus = computeMealStatus(windowDoc);
      if (!windowStatus.is_active) {
        return res.status(400).json({
          success: false,
          message: `The meal category '${targetMealType.toUpperCase()}' is currently not offered by Canteen Management.`,
        });
      }
      if (!windowStatus.is_currently_open) {
        return res.status(400).json({
          success: false,
          message: `Ordering for ${targetMealType.toUpperCase()} is currently closed. Operating window: ${windowStatus.formatted_start_time} – ${windowStatus.formatted_end_time}.`,
        });
      }
    }

    // Verify item prices from DB to prevent client-side tampering
    let calculatedTotal = 0;
    const validatedItems = [];

    for (const cartItem of items) {
      const rawId = cartItem.menu_item || cartItem.id;
      const numericId = rawId ? parseInt(rawId, 10) : NaN;
      let dbItem = null;

      if (!isNaN(numericId)) {
        dbItem = await prisma.menuItem.findUnique({ where: { id: numericId } });
      }

      if (!dbItem && (cartItem.name || cartItem.item_name)) {
        const nameToSearch = cartItem.name || cartItem.item_name;
        dbItem = await prisma.menuItem.findFirst({ where: { name: nameToSearch, is_active: true } });
      }

      if (!dbItem || !dbItem.is_active) {
        return res.status(400).json({
          success: false,
          message: `Item '${cartItem.name || cartItem.item_name || 'selected'}' is currently unavailable.`,
        });
      }

      const itemQuantity = Number(cartItem.quantity) || 1;
      const itemPrice = Number(dbItem.price);
      const itemTotal = itemPrice * itemQuantity;
      calculatedTotal += itemTotal;

      validatedItems.push({
        menu_item_id: dbItem.id,
        item_name: dbItem.name,
        price: itemPrice,
        quantity: itemQuantity,
      });
    }

    if (calculatedTotal <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order total.' });
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const amountInPaisa = Math.round(calculatedTotal * 100);

    let razorpayOrderId = null;
    let rzpErrorDetails = null;

    try {
      const razorpay = getRazorpayInstance();
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaisa,
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        notes: { student_id: String(studentId), meal_type },
      });
      razorpayOrderId = rzpOrder.id;
    } catch (rzpErr) {
      console.error(`[Razorpay] ERROR creating order:`, {
        message: rzpErr.message,
        description: rzpErr.error?.description || rzpErr.description,
      });
      rzpErrorDetails = rzpErr.error?.description || rzpErr.message || 'Razorpay API error';

      if (!process.env.RAZORPAY_KEY_ID && process.env.NODE_ENV !== 'production') {
        razorpayOrderId = `order_mock_${Date.now()}`;
      } else {
        return res.status(500).json({
          success: false,
          message: `Razorpay Order Creation Failed: ${rzpErrorDetails}.`,
        });
      }
    }

    // Create Order + OrderItems atomically in a Prisma transaction
    const newOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          student_id: studentId,
          meal_type: targetMealType,
          total_amount: calculatedTotal,
          payment_status: 'pending',
          razorpay_order_id: razorpayOrderId,
          order_status: 'placed',
          date: todayDate,
        },
      });

      await tx.orderItem.createMany({
        data: validatedItems.map((item) => ({
          order_id: order.id,
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          price: item.price,
          quantity: item.quantity,
        })),
      });

      return order;
    });

    return res.status(201).json({
      success: true,
      message: 'Razorpay order created successfully.',
      razorpay_order_id: razorpayOrderId,
      amount: amountInPaisa,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YourKeyIdHere',
      order_db_id: newOrder.id,
      total_amount: calculatedTotal,
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    return res.status(500).json({ success: false, message: `Failed to initiate payment order: ${error.message}` });
  }
};

// Verify Payment Signature & Fulfill Order
const verifyPaymentAndFulfill = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_db_id } = req.body;

    let order;
    if (order_db_id) {
      order = await prisma.order.findUnique({
        where: { id: parseInt(order_db_id, 10) },
        include: { items: true, student: { select: { id: true, name: true, roll_no: true, email: true } } },
      });
    } else if (razorpay_order_id) {
      order = await prisma.order.findFirst({
        where: { razorpay_order_id },
        include: { items: true, student: { select: { id: true, name: true, roll_no: true, email: true } } },
      });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order reference not found.' });
    }

    if (order.payment_status === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified.',
        order: shapeOrder(order),
      });
    }

    // Verify signature if secret and signature are present
    const secret = process.env.RAZORPAY_KEY_SECRET;
    let isValidSignature = true;

    if (secret && razorpay_signature && !razorpay_order_id?.startsWith('order_mock_')) {
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      isValidSignature = generatedSignature === razorpay_signature;
    }

    if (!isValidSignature) {
      await prisma.order.update({ where: { id: order.id }, data: { payment_status: 'failed' } });
      return res.status(400).json({ success: false, message: 'Payment verification signature failed.' });
    }

    // Payment is verified — generate daily sequential Token Number
    const { tokenNumber, sequenceNumber } = await generateTokenNumber(order.meal_type, order.date);

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        payment_status: 'paid',
        payment_method: 'razorpay',
        razorpay_payment_id: razorpay_payment_id || `pay_mock_${Date.now()}`,
        razorpay_signature: razorpay_signature || 'mock_sig',
        token_number: tokenNumber,
        daily_sequence: sequenceNumber,
        order_status: 'placed',
      },
      include: { items: true, student: { select: { id: true, name: true, roll_no: true, email: true } } },
    });

    const orderCounts = await computeKitchenOrderCounts(updatedOrder.date);

    // Broadcast live Socket.IO event to Kitchen Screen
    const io = req.app.get('socketio');
    if (io) {
      const socketPayload = {
        _id: updatedOrder.id,
        id: updatedOrder.id,
        token_number: updatedOrder.token_number,
        meal_type: updatedOrder.meal_type,
        items: updatedOrder.items.map((it) => ({ item_name: it.item_name, quantity: it.quantity, price: Number(it.price) })),
        student_name: updatedOrder.student?.name || 'Student',
        roll_no: updatedOrder.student?.roll_no || '',
        total_amount: Number(updatedOrder.total_amount),
        order_status: updatedOrder.order_status,
        created_at: updatedOrder.created_at,
        orderCounts,
      };

      io.to('kitchen').emit('order:new', socketPayload);
      io.to('kitchen').emit('order-counts-updated', socketPayload);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and token generated successfully!',
      token_number: updatedOrder.token_number,
      order: shapeOrder(updatedOrder),
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ success: false, message: 'Error verifying payment.' });
  }
};

// Compute Kitchen Order Counts Aggregation using Prisma native groupBy
const computeKitchenOrderCounts = async (targetDate) => {
  const dateStr = targetDate || new Date().toISOString().split('T')[0];

  const groupedOrders = await prisma.order.groupBy({
    by: ['meal_type', 'order_status'],
    where: {
      date: dateStr,
      payment_status: 'paid',
    },
    _count: true,
  });

  const counts = {
    breakfast: { total_orders_today: 0, active_tokens: 0 },
    lunch: { total_orders_today: 0, active_tokens: 0 },
    snacks: { total_orders_today: 0, active_tokens: 0 },
    dinner: { total_orders_today: 0, active_tokens: 0 },
    combined: { total_orders_today: 0, active_tokens: 0 },
    todays_menu_summary: [],
  };

  const activeStatuses = ['placed', 'preparing', 'ready'];

  groupedOrders.forEach((group) => {
    const meal = (group.meal_type || '').toLowerCase();
    const count = group._count || 0;
    const isActive = activeStatuses.includes(group.order_status);

    if (counts[meal]) {
      counts[meal].total_orders_today += count;
      if (isActive) {
        counts[meal].active_tokens += count;
      }
    }
    counts.combined.total_orders_today += count;
    if (isActive) {
      counts.combined.active_tokens += count;
    }
  });

  // Today's menu summary using OrderItem queries
  try {
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          date: dateStr,
          payment_status: 'paid',
        },
      },
      select: {
        item_name: true,
        quantity: true,
        order_id: true,
      },
    });

    const summaryMap = {};
    orderItems.forEach((item) => {
      if (!summaryMap[item.item_name]) {
        summaryMap[item.item_name] = { item_name: item.item_name, total_quantity: 0, orderIds: new Set() };
      }
      summaryMap[item.item_name].total_quantity += item.quantity;
      summaryMap[item.item_name].orderIds.add(item.order_id);
    });

    counts.todays_menu_summary = Object.values(summaryMap)
      .map((s) => ({
        item_name: s.item_name,
        total_quantity: s.total_quantity,
        total_orders: s.orderIds.size,
      }))
      .sort((a, b) => b.total_quantity - a.total_quantity);
  } catch (err) {
    console.warn('Menu summary calculation warning:', err);
  }

  return counts;
};

// Get Kitchen Order Counts API Endpoint
const getKitchenOrderCounts = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const orderCounts = await computeKitchenOrderCounts(dateStr);
    return res.status(200).json({
      success: true,
      date: dateStr,
      orderCounts,
    });
  } catch (error) {
    console.error('Error fetching kitchen order counts:', error);
    return res.status(500).json({ success: false, message: 'Error fetching order counts.' });
  }
};

// Razorpay Webhook Handler
const razorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    if (webhookSecret && signature) {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');

      if (digest !== signature) {
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload.payment.entity;
      const rzpOrderId = paymentEntity.order_id;

      const order = await prisma.order.findFirst({
        where: { razorpay_order_id: rzpOrderId },
        include: { items: true, student: { select: { id: true, name: true, roll_no: true } } },
      });

      if (order && order.payment_status !== 'paid') {
        const { tokenNumber, sequenceNumber } = await generateTokenNumber(order.meal_type, order.date);
        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            payment_status: 'paid',
            payment_method: 'razorpay',
            razorpay_payment_id: paymentEntity.id,
            token_number: tokenNumber,
            daily_sequence: sequenceNumber,
          },
        });

        const orderCounts = await computeKitchenOrderCounts(updatedOrder.date);
        const io = req.app.get('socketio');
        if (io) {
          io.to('kitchen').emit('order:new', shapeOrder({ ...updatedOrder, items: order.items, student: order.student }));
          io.to('kitchen').emit('order-counts-updated', {
            orderId: updatedOrder.id,
            token_number: updatedOrder.token_number,
            meal_type: updatedOrder.meal_type,
            order_status: updatedOrder.order_status,
            orderCounts,
          });
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
};

// Get Past Orders for logged-in Student
const getStudentOrders = async (req, res) => {
  try {
    const retentionDays = parseInt(process.env.ORDER_RETENTION_DAYS, 10) || 60;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        student_id: req.studentId,
        payment_status: 'paid',
        created_at: { gte: cutoffDate },
      },
      include: { items: true },
      orderBy: { created_at: 'desc' },
    });

    const shaped = orders.map((o) => ({
      ...o,
      _id: o.id,
      total_amount: Number(o.total_amount),
      items: o.items.map((it) => ({ ...it, _id: it.id, price: Number(it.price) })),
    }));

    return res.status(200).json({
      success: true,
      retention_days: retentionDays,
      count: shaped.length,
      orders: shaped,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching order history.' });
  }
};

// Get Kitchen Screen Orders for Today (Admin)
const getKitchenOrders = async (req, res) => {
  try {
    const { date, meal_type, status } = req.query;
    const where = { payment_status: 'paid' };

    where.date = date || new Date().toISOString().split('T')[0];
    if (meal_type) where.meal_type = meal_type.toLowerCase();
    if (status) where.order_status = status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, roll_no: true, email: true } },
        items: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders: orders.map(shapeOrder),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching kitchen orders.' });
  }
};

// Update Order Status (Admin tap to mark preparing / ready / delivered)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { order_status } = req.body;
    const targetId = parseInt(id, 10);

    const validStatuses = ['placed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!order_status || !validStatuses.includes(order_status)) {
      return res.status(400).json({ success: false, message: 'Invalid order_status' });
    }

    const order = await prisma.order.update({
      where: { id: targetId },
      data: { order_status },
      include: {
        student: { select: { id: true, name: true, roll_no: true } },
        items: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const orderCounts = await computeKitchenOrderCounts(order.date);

    const io = req.app.get('socketio');
    if (io) {
      const updatePayload = {
        orderId: order.id,
        id: order.id,
        token_number: order.token_number,
        meal_type: order.meal_type,
        order_status: order.order_status,
        student_name: order.student?.name || 'Student',
        updated_at: new Date(),
        orderCounts,
      };

      io.to('kitchen').emit('order-counts-updated', updatePayload);
      io.to('kitchen').emit('order:status_updated', updatePayload);

      // Broadcast to student room
      if (order.student?.id) {
        io.to(`student:${order.student.id}`).emit('student:order_updated', {
          orderId: order.id,
          token_number: order.token_number,
          order_status: order.order_status,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to '${order_status}'`,
      order: shapeOrder(order),
      orderCounts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating order status.' });
  }
};

// Get Admin Order History (Paginated, Filterable, Role-Based Field Stripping for Staff)
const getAdminOrderHistory = async (req, res) => {
  try {
    const { from, to, meal_type, order_status, payment_status, page = 1, limit = 50 } = req.query;

    const retentionDays = parseInt(process.env.ORDER_RETENTION_DAYS, 10) || 60;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where = { created_at: { gte: cutoffDate } };

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    if (meal_type) where.meal_type = meal_type.toLowerCase();
    if (order_status) where.order_status = order_status.toLowerCase();
    if (payment_status) where.payment_status = payment_status.toLowerCase();

    const [totalCount, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          student: { select: { id: true, name: true, roll_no: true, email: true } },
          items: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    const isSuperAdmin = req.admin && req.admin.role === 'super_admin';

    const sanitizedOrders = orders.map((order) => {
      const shaped = shapeOrder(order);
      if (!isSuperAdmin) {
        delete shaped.total_amount;
        delete shaped.payment_method;
        shaped.items = (shaped.items || []).map(({ price, ...rest }) => rest);
      }
      return shaped;
    });

    // Income summary for range (super_admin only) via Prisma native groupBy
    let incomeSummary = null;
    if (isSuperAdmin) {
      const incomeWhere = { ...where, payment_status: 'paid' };
      const incomeGroups = await prisma.order.groupBy({
        by: ['payment_method'],
        where: incomeWhere,
        _sum: { total_amount: true },
        _count: true,
      });

      let totalIncome = 0;
      let totalPaidOrders = 0;
      const breakdown = {
        razorpay: { amount: 0, count: 0 },
        counter_cash: { amount: 0, count: 0 },
        counter_upi: { amount: 0, count: 0 },
        other: { amount: 0, count: 0 },
      };

      incomeGroups.forEach((group) => {
        const method = group.payment_method || 'counter_cash';
        const amt = Number(group._sum?.total_amount || 0);
        const cnt = Number(group._count || 0);
        if (!breakdown[method]) breakdown[method] = { amount: 0, count: 0 };
        breakdown[method].amount += amt;
        breakdown[method].count += cnt;
        totalIncome += amt;
        totalPaidOrders += cnt;
      });

      incomeSummary = { total_income: totalIncome, total_paid_orders: totalPaidOrders, breakdown };
    }

    return res.status(200).json({
      success: true,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(totalCount / limitNum) || 1,
      total_count: totalCount,
      is_super_admin: isSuperAdmin,
      income_summary: incomeSummary,
      orders: sanitizedOrders,
    });
  } catch (error) {
    console.error('Error fetching admin order history:', error);
    return res.status(500).json({ success: false, message: 'Error fetching order history.' });
  }
};

// Get Today's Total Income & Payment Method Breakdown (Strictly Super Admin Only)
const getTodayIncome = async (req, res) => {
  try {
    const todayDate = new Date().toISOString().split('T')[0];

    const incomeGroups = await prisma.order.groupBy({
      by: ['payment_method'],
      where: { date: todayDate, payment_status: 'paid' },
      _sum: { total_amount: true },
      _count: true,
    });

    let totalIncome = 0;
    let totalPaidOrders = 0;
    const breakdown = {
      razorpay: { amount: 0, count: 0 },
      counter_cash: { amount: 0, count: 0 },
      counter_upi: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    };

    incomeGroups.forEach((group) => {
      const method = group.payment_method || 'counter_cash';
      const amt = Number(group._sum?.total_amount || 0);
      const cnt = Number(group._count || 0);
      if (!breakdown[method]) breakdown[method] = { amount: 0, count: 0 };
      breakdown[method].amount += amt;
      breakdown[method].count += cnt;
      totalIncome += amt;
      totalPaidOrders += cnt;
    });

    return res.status(200).json({
      success: true,
      date: todayDate,
      total_income: totalIncome,
      total_paid_orders: totalPaidOrders,
      breakdown,
    });
  } catch (error) {
    console.error('Error fetching today income:', error);
    return res.status(500).json({ success: false, message: 'Error fetching today income.' });
  }
};

// Get Income History for Date Range & Payment Method Breakdown (Strictly Super Admin Only)
const getIncomeHistory = async (req, res) => {
  try {
    const { from, to, meal_type } = req.query;
    const retentionDays = parseInt(process.env.ORDER_RETENTION_DAYS, 10) || 60;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const where = { payment_status: 'paid', created_at: { gte: cutoffDate } };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }
    if (meal_type) where.meal_type = meal_type.toLowerCase();

    const incomeGroups = await prisma.order.groupBy({
      by: ['payment_method'],
      where,
      _sum: { total_amount: true },
      _count: true,
    });

    let totalIncome = 0;
    let totalPaidOrders = 0;
    const breakdown = {
      razorpay: { amount: 0, count: 0 },
      counter_cash: { amount: 0, count: 0 },
      counter_upi: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    };

    incomeGroups.forEach((group) => {
      const method = group.payment_method || 'counter_cash';
      const amt = Number(group._sum?.total_amount || 0);
      const cnt = Number(group._count || 0);
      if (!breakdown[method]) breakdown[method] = { amount: 0, count: 0 };
      breakdown[method].amount += amt;
      breakdown[method].count += cnt;
      totalIncome += amt;
      totalPaidOrders += cnt;
    });

    return res.status(200).json({
      success: true,
      from: from || null,
      to: to || null,
      meal_type: meal_type || null,
      total_income: totalIncome,
      total_paid_orders: totalPaidOrders,
      breakdown,
    });
  } catch (error) {
    console.error('Error fetching income history:', error);
    return res.status(500).json({ success: false, message: 'Error fetching income history.' });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyPaymentAndFulfill,
  razorpayWebhook,
  getStudentOrders,
  getKitchenOrders,
  getKitchenOrderCounts,
  updateOrderStatus,
  getAdminOrderHistory,
  getTodayIncome,
  getIncomeHistory,
};

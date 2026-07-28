const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { generateTokenNumber } = require('../services/tokenGenerator');

const MealWindow = require('../models/MealWindow');
const { computeMealStatus } = require('./menuController');

// Initialize Razorpay SDK instance safely
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    console.warn('[Razorpay Diagnostics] Warning: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in process.env!');
  }
  return new Razorpay({
    key_id: key_id || 'rzp_test_YourKeyIdHere',
    key_secret: key_secret || 'YourKeySecretHere',
  });
};

// Create Razorpay Order (STRICT STUDENT JWT ENFORCED VIA verifyStudent MIDDLEWARE)
const createRazorpayOrder = async (req, res) => {
  try {
    const { items, meal_type } = req.body;
    const studentId = req.studentId; // Injected by verifyStudent middleware

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required.' });
    }

    if (!meal_type || !['breakfast', 'lunch', 'dinner', 'snacks'].includes(meal_type.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Valid meal_type is required.' });
    }

    const targetMealType = meal_type.toLowerCase();

    // Check MealWindow status: Must be active and currently open for ordering
    const windowDoc = await MealWindow.findOne({ meal_type: targetMealType });
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
      const itemId = cartItem.menu_item || cartItem.id;
      let dbItem = null;

      if (itemId && mongoose.Types.ObjectId.isValid(itemId)) {
        dbItem = await MenuItem.findById(itemId);
      }

      if (!dbItem && (cartItem.name || cartItem.item_name)) {
        const nameToSearch = cartItem.name || cartItem.item_name;
        dbItem = await MenuItem.findOne({ name: nameToSearch, is_active: true });
      }

      if (!dbItem || !dbItem.is_active) {
        return res.status(400).json({
          success: false,
          message: `Item '${cartItem.name || cartItem.item_name || 'selected'}' is currently unavailable.`,
        });
      }

      const itemQuantity = Number(cartItem.quantity) || 1;
      const itemTotal = dbItem.price * itemQuantity;
      calculatedTotal += itemTotal;

      validatedItems.push({
        menu_item: dbItem._id,
        item_name: dbItem.name,
        price: dbItem.price,
        quantity: itemQuantity,
      });
    }

    if (calculatedTotal <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order total.' });
    }

    const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const amountInPaisa = Math.round(calculatedTotal * 100);

    console.log(`[Razorpay Diagnostics] Backend initiating order creation:`, {
      studentId: studentId.toString(),
      meal_type,
      itemsCount: validatedItems.length,
      calculatedTotalINR: calculatedTotal,
      amountInPaisa,
      configuredKeyId: process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 10)}...` : 'MISSING',
    });

    let razorpayOrderId = null;
    let rzpErrorDetails = null;

    try {
      const razorpay = getRazorpayInstance();
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaisa,
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        notes: {
          student_id: studentId.toString(),
          meal_type,
        },
      });
      razorpayOrderId = rzpOrder.id;
      console.log(`[Razorpay Diagnostics] Order successfully created on Razorpay API:`, {
        id: rzpOrder.id,
        amount: rzpOrder.amount,
        status: rzpOrder.status,
      });
    } catch (rzpErr) {
      console.error(`[Razorpay Diagnostics] ERROR creating Razorpay order on Razorpay API:`, {
        message: rzpErr.message,
        code: rzpErr.code,
        statusCode: rzpErr.statusCode,
        description: rzpErr.error?.description || rzpErr.description,
      });
      rzpErrorDetails = rzpErr.error?.description || rzpErr.message || 'Razorpay API error';

      // Fallback for local development when no keys are configured
      if (!process.env.RAZORPAY_KEY_ID && process.env.NODE_ENV !== 'production') {
        console.warn(`[Razorpay Diagnostics] Local development fallback: generating mock order ID because RAZORPAY_KEY_ID is missing.`);
        razorpayOrderId = `order_mock_${Date.now()}`;
      } else {
        return res.status(500).json({
          success: false,
          message: `Razorpay Order Creation Failed: ${rzpErrorDetails}. Please confirm RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on Render.`,
        });
      }
    }

    // Save pending Order doc in MongoDB
    const newOrder = new Order({
      student_id: studentId,
      meal_type: meal_type.toLowerCase(),
      items: validatedItems,
      total_amount: calculatedTotal,
      payment_status: 'pending',
      razorpay_order_id: razorpayOrderId,
      order_status: 'placed',
      date: todayDate,
    });

    await newOrder.save();

    return res.status(201).json({
      success: true,
      message: 'Razorpay order created successfully.',
      razorpay_order_id: razorpayOrderId,
      amount: amountInPaisa,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YourKeyIdHere',
      order_db_id: newOrder._id,
      total_amount: calculatedTotal,
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    return res.status(500).json({ success: false, message: `Failed to initiate payment order: ${error.message}` });
  }
};

// Request Counter Payment Order (Student submits request, NO token assigned yet)
const requestCounterPaymentOrder = async (req, res) => {
  try {
    const { items, meal_type } = req.body;
    const studentId = req.studentId; // Injected by verifyStudent middleware

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required.' });
    }

    if (!meal_type || !['breakfast', 'lunch', 'dinner', 'snacks'].includes(meal_type.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Valid meal_type is required.' });
    }

    const targetMealType = meal_type.toLowerCase();

    // Check MealWindow status: Must be active and currently open for ordering
    const windowDoc = await MealWindow.findOne({ meal_type: targetMealType });
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
      const itemId = cartItem.menu_item || cartItem.id;
      let dbItem = null;

      if (itemId && mongoose.Types.ObjectId.isValid(itemId)) {
        dbItem = await MenuItem.findById(itemId);
      }

      if (!dbItem && (cartItem.name || cartItem.item_name)) {
        const nameToSearch = cartItem.name || cartItem.item_name;
        dbItem = await MenuItem.findOne({ name: nameToSearch, is_active: true });
      }

      if (!dbItem || !dbItem.is_active) {
        return res.status(400).json({
          success: false,
          message: `Item '${cartItem.name || cartItem.item_name || 'selected'}' is currently unavailable.`,
        });
      }

      const itemQuantity = Number(cartItem.quantity) || 1;
      const itemTotal = dbItem.price * itemQuantity;
      calculatedTotal += itemTotal;

      validatedItems.push({
        menu_item: dbItem._id,
        item_name: dbItem.name,
        price: dbItem.price,
        quantity: itemQuantity,
      });
    }

    if (calculatedTotal <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order total.' });
    }

    const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Save Order document with payment_status: 'awaiting_counter_payment' (NO TOKEN NUMBER YET)
    const newOrder = new Order({
      student_id: studentId,
      meal_type: targetMealType,
      items: validatedItems,
      total_amount: calculatedTotal,
      payment_status: 'awaiting_counter_payment',
      razorpay_order_id: `counter_req_${Date.now()}`,
      token_number: null,
      daily_sequence: 0,
      order_status: 'placed',
      date: todayDate,
    });

    await newOrder.save();
    await newOrder.populate('student_id', 'name roll_no email');

    // Broadcast live Socket.IO notification to Admin Panel
    const io = req.app.get('socketio');
    if (io) {
      io.emit('counter:order_requested', {
        orderId: newOrder._id,
        student_name: newOrder.student_id?.name || 'Student',
        roll_no: newOrder.student_id?.roll_no || '',
        meal_type: newOrder.meal_type,
        total_amount: newOrder.total_amount,
        items: newOrder.items,
        created_at: newOrder.created_at,
      });
    }

    console.log(`[Counter Order Requested] Student: ${newOrder.student_id?.name}, Meal: ${targetMealType}, Total: ₹${calculatedTotal}`);

    return res.status(201).json({
      success: true,
      message: `Order sent to counter! Please pay ₹${calculatedTotal} at the canteen counter to receive your token.`,
      order: newOrder,
    });
  } catch (error) {
    console.error('Request counter payment order error:', error);
    return res.status(500).json({ success: false, message: `Failed to request counter payment order: ${error.message}` });
  }
};

// Get Pending Counter Payment Orders for Admin Panel
const getPendingCounterOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      payment_status: 'awaiting_counter_payment',
    })
      .populate('student_id', 'name roll_no email')
      .sort({ created_at: 1 }); // Oldest first so staff processes requests in order

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error('Error fetching pending counter orders:', error);
    return res.status(500).json({ success: false, message: 'Error fetching pending counter payment orders.' });
  }
};

// Mark Counter Order as Paid & Generate Token (Admin Action)
const markCounterOrderPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method } = req.body || {};

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order request not found.' });
    }

    // Idempotency check: if order is already marked paid, return friendly response
    if (order.payment_status === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Payment already confirmed for this order.',
        token_number: order.token_number,
        order,
      });
    }

    if (order.payment_status !== 'awaiting_counter_payment') {
      return res.status(400).json({
        success: false,
        message: `Order status is '${order.payment_status}' and cannot be marked paid at counter.`,
      });
    }

    // Atomically generate token number from shared daily counter
    const { tokenNumber, sequenceNumber } = await generateTokenNumber(order.meal_type, order.date);

    order.payment_status = 'paid';
    order.payment_method = ['counter_cash', 'counter_upi', 'other'].includes(payment_method)
      ? payment_method
      : 'counter_cash';
    order.token_number = tokenNumber;
    order.daily_sequence = sequenceNumber;
    order.order_status = 'placed';
    await order.save();

    await order.populate('student_id', 'name roll_no email');

    // Compute updated kitchen counts
    const orderCounts = await computeKitchenOrderCounts(order.date);

    // Broadcast live Socket.IO events to Kitchen & Student
    const io = req.app.get('socketio');
    if (io) {
      const socketPayload = {
        _id: order._id,
        id: order._id,
        token_number: order.token_number,
        meal_type: order.meal_type,
        items: order.items,
        payment_status: order.payment_status,
        student_name: order.student_id?.name || 'Student',
        roll_no: order.student_id?.roll_no || '',
        total_amount: order.total_amount,
        order_status: order.order_status,
        created_at: order.created_at,
        orderCounts,
      };

      // Real-time update to Kitchen Screen
      io.to('kitchen').emit('order:new', socketPayload);
      io.to('kitchen').emit('order-counts-updated', socketPayload);

      // Real-time update to specific Student room
      io.to(`student:${order.student_id?._id || order.student_id}`).emit('student:order_updated', {
        orderId: order._id,
        token_number: order.token_number,
        payment_status: 'paid',
        order,
      });
    }

    console.log(`[Counter Order Paid] Order ID: ${order._id}, Token: ${tokenNumber}`);

    return res.status(200).json({
      success: true,
      message: 'Counter payment confirmed & token generated successfully!',
      token_number: tokenNumber,
      order,
      orderCounts,
    });
  } catch (error) {
    console.error('Error marking counter order as paid:', error);
    return res.status(500).json({ success: false, message: 'Error marking counter payment as paid.' });
  }
};

// Verify Payment Signature & Fulfill Order
const verifyPaymentAndFulfill = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_db_id } = req.body;

    let order;
    if (order_db_id) {
      order = await Order.findById(order_db_id);
    } else if (razorpay_order_id) {
      order = await Order.findOne({ razorpay_order_id });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order reference not found.' });
    }

    if (order.payment_status === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified.',
        order,
      });
    }

    // Verify signature if secret and signature are present
    const secret = process.env.RAZORPAY_KEY_SECRET;
    let isValidSignature = true;

    if (secret && razorpay_signature && !razorpay_order_id.startsWith('order_mock_')) {
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      isValidSignature = generatedSignature === razorpay_signature;
    }

    if (!isValidSignature) {
      order.payment_status = 'failed';
      await order.save();
      return res.status(400).json({ success: false, message: 'Payment verification signature failed.' });
    }

    // Payment is verified! Generate daily sequential Token Number
    const { tokenNumber, sequenceNumber } = await generateTokenNumber(order.meal_type, order.date);

    order.payment_status = 'paid';
    order.payment_method = 'razorpay';
    order.razorpay_payment_id = razorpay_payment_id || `pay_mock_${Date.now()}`;
    order.razorpay_signature = razorpay_signature || 'mock_sig';
    order.token_number = tokenNumber;
    order.daily_sequence = sequenceNumber;
    order.order_status = 'placed';
    await order.save();

    await order.populate('student_id', 'name roll_no email');

    // Compute updated order counts for live kitchen update
    const orderCounts = await computeKitchenOrderCounts(order.date);

    // Broadcast live Socket.IO event to Kitchen Screen
    const io = req.app.get('socketio');
    if (io) {
      const socketPayload = {
        _id: order._id,
        id: order._id,
        token_number: order.token_number,
        meal_type: order.meal_type,
        items: order.items,
        student_name: order.student_id?.name || 'Student',
        roll_no: order.student_id?.roll_no || '',
        total_amount: order.total_amount,
        order_status: order.order_status,
        created_at: order.created_at,
        orderCounts,
      };

      io.to('kitchen').emit('order:new', socketPayload);
      io.to('kitchen').emit('order-counts-updated', socketPayload);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and token generated successfully!',
      token_number: order.token_number,
      order,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ success: false, message: 'Error verifying payment.' });
  }
};

// Compute Kitchen Order Counts Aggregation (Total Orders Today vs Active Tokens)
const computeKitchenOrderCounts = async (targetDate) => {
  const dateStr = targetDate || new Date().toISOString().split('T')[0];
  const pipeline = [
    {
      $match: {
        date: dateStr,
        payment_status: 'paid',
      },
    },
    {
      $group: {
        _id: '$meal_type',
        total_orders_today: { $sum: 1 },
        active_tokens: {
          $sum: {
            $cond: [
              { $in: ['$order_status', ['placed', 'preparing', 'ready']] },
              1,
              0,
            ],
          },
        },
      },
    },
  ];

  const results = await Order.aggregate(pipeline);

  const counts = {
    breakfast: { total_orders_today: 0, active_tokens: 0 },
    lunch: { total_orders_today: 0, active_tokens: 0 },
    snacks: { total_orders_today: 0, active_tokens: 0 },
    dinner: { total_orders_today: 0, active_tokens: 0 },
    combined: { total_orders_today: 0, active_tokens: 0 },
    todays_menu_summary: [],
  };

  results.forEach((row) => {
    const meal = (row._id || '').toLowerCase();
    if (counts[meal]) {
      counts[meal].total_orders_today = row.total_orders_today;
      counts[meal].active_tokens = row.active_tokens;
    }
    counts.combined.total_orders_today += row.total_orders_today;
    counts.combined.active_tokens += row.active_tokens;
  });

  // Aggregation for Today's Menu Ordered Summary ("What's Cooking Today")
  const summaryPipeline = [
    {
      $match: {
        date: dateStr,
        payment_status: 'paid',
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.item_name',
        total_quantity: { $sum: '$items.quantity' },
        total_orders: { $sum: 1 },
      },
    },
    { $sort: { total_quantity: -1 } },
  ];

  const summaryResults = await Order.aggregate(summaryPipeline);
  counts.todays_menu_summary = summaryResults.map((r) => ({
    item_name: r._id,
    total_quantity: r.total_quantity,
    total_orders: r.total_orders,
  }));

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

      const order = await Order.findOne({ razorpay_order_id: rzpOrderId });
      if (order && order.payment_status !== 'paid') {
        const { tokenNumber, sequenceNumber } = await generateTokenNumber(order.meal_type, order.date);
        order.payment_status = 'paid';
        order.payment_method = 'razorpay';
        order.razorpay_payment_id = paymentEntity.id;
        order.token_number = tokenNumber;
        order.daily_sequence = sequenceNumber;
        await order.save();

        const orderCounts = await computeKitchenOrderCounts(order.date);
        const io = req.app.get('socketio');
        if (io) {
          io.to('kitchen').emit('order:new', order);
          io.to('kitchen').emit('order-counts-updated', {
            orderId: order._id,
            token_number: order.token_number,
            meal_type: order.meal_type,
            order_status: order.order_status,
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

// Get Past Orders for logged-in Student (Enforces retention window at DB query level)
const getStudentOrders = async (req, res) => {
  try {
    const retentionDays = parseInt(process.env.ORDER_RETENTION_DAYS, 10) || 60;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const orders = await Order.find({
      student_id: req.studentId,
      payment_status: { $in: ['paid', 'awaiting_counter_payment'] },
      created_at: { $gte: cutoffDate },
    }).sort({ created_at: -1 });

    return res.status(200).json({
      success: true,
      retention_days: retentionDays,
      count: orders.length,
      orders: orders || [],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching order history.' });
  }
};

// Get Kitchen Screen Orders for Today (Admin)
const getKitchenOrders = async (req, res) => {
  try {
    const { date, meal_type, status } = req.query;
    const filter = { payment_status: 'paid' };

    filter.date = date || new Date().toISOString().split('T')[0];

    if (meal_type) {
      filter.meal_type = meal_type.toLowerCase();
    }
    if (status) {
      filter.order_status = status;
    }

    const orders = await Order.find(filter)
      .populate('student_id', 'name roll_no email')
      .sort({ created_at: 1 }); // Sort ascending by time for token list

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
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

    const validStatuses = ['placed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!order_status || !validStatuses.includes(order_status)) {
      return res.status(400).json({ success: false, message: 'Invalid order_status' });
    }

    const order = await Order.findByIdAndUpdate(id, { order_status }, { new: true }).populate('student_id', 'name roll_no');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const orderCounts = await computeKitchenOrderCounts(order.date);

    // Broadcast status change via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      const updatePayload = {
        orderId: order._id,
        id: order._id,
        token_number: order.token_number,
        meal_type: order.meal_type,
        order_status: order.order_status,
        student_name: order.student_id?.name || 'Student',
        updated_at: new Date(),
        orderCounts,
      };

      io.to('kitchen').emit('order-counts-updated', updatePayload);
      io.to('kitchen').emit('order:status_updated', updatePayload);

      // Broadcast to student room
      io.to(`student:${order.student_id?._id || order.student_id}`).emit('student:order_updated', {
        orderId: order._id,
        token_number: order.token_number,
        order_status: order.order_status,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to '${order_status}'`,
      order,
      orderCounts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating order status.' });
  }
};
// Get Admin Order History (Paginated, Filterable, Role-Based Field Stripping for Staff)
const getAdminOrderHistory = async (req, res) => {
  try {
    const {
      from,
      to,
      meal_type,
      order_status,
      payment_status,
      page = 1,
      limit = 50,
    } = req.query;

    const retentionDays = parseInt(process.env.ORDER_RETENTION_DAYS, 10) || 60;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      created_at: { $gte: cutoffDate },
    };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    if (meal_type) filter.meal_type = meal_type.toLowerCase();
    if (order_status) filter.order_status = order_status.toLowerCase();
    if (payment_status) filter.payment_status = payment_status.toLowerCase();

    const totalCount = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('student_id', 'name roll_no email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum);

    const isSuperAdmin = req.admin && req.admin.role === 'super_admin';

    // Server-side field stripping: Non-super_admin (staff) accounts must never receive financial fields
    const sanitizedOrders = orders.map((order) => {
      const obj = order.toObject ? order.toObject() : { ...order };
      if (!isSuperAdmin) {
        delete obj.total_amount;
        delete obj.payment_method;
        if (Array.isArray(obj.items)) {
          obj.items = obj.items.map((item) => {
            const { price, ...rest } = item;
            return rest;
          });
        }
      }
      return obj;
    });

    // Income summary for range (calculated ONLY for super_admin)
    let incomeSummary = null;
    if (isSuperAdmin) {
      const incomeFilter = { ...filter, payment_status: 'paid' };
      const aggregation = await Order.aggregate([
        { $match: incomeFilter },
        {
          $group: {
            _id: { $ifNull: ['$payment_method', 'counter_cash'] },
            total_amount: { $sum: '$total_amount' },
            order_count: { $sum: 1 },
          },
        },
      ]);

      let totalIncome = 0;
      let totalPaidOrders = 0;
      const breakdown = {
        razorpay: { amount: 0, count: 0 },
        counter_cash: { amount: 0, count: 0 },
        counter_upi: { amount: 0, count: 0 },
        other: { amount: 0, count: 0 },
      };

      aggregation.forEach((row) => {
        const method = row._id || 'counter_cash';
        if (!breakdown[method]) breakdown[method] = { amount: 0, count: 0 };
        breakdown[method].amount += row.total_amount;
        breakdown[method].count += row.order_count;
        totalIncome += row.total_amount;
        totalPaidOrders += row.order_count;
      });

      incomeSummary = {
        total_income: totalIncome,
        total_paid_orders: totalPaidOrders,
        breakdown,
      };
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
    const aggregation = await Order.aggregate([
      {
        $match: {
          date: todayDate,
          payment_status: 'paid',
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$payment_method', 'counter_cash'] },
          total_amount: { $sum: '$total_amount' },
          order_count: { $sum: 1 },
        },
      },
    ]);

    let totalIncome = 0;
    let totalPaidOrders = 0;
    const breakdown = {
      razorpay: { amount: 0, count: 0 },
      counter_cash: { amount: 0, count: 0 },
      counter_upi: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    };

    aggregation.forEach((row) => {
      const method = row._id || 'counter_cash';
      if (!breakdown[method]) breakdown[method] = { amount: 0, count: 0 };
      breakdown[method].amount += row.total_amount;
      breakdown[method].count += row.order_count;
      totalIncome += row.total_amount;
      totalPaidOrders += row.order_count;
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

    const filter = {
      payment_status: 'paid',
      created_at: { $gte: cutoffDate },
    };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    if (meal_type) filter.meal_type = meal_type.toLowerCase();

    const aggregation = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $ifNull: ['$payment_method', 'counter_cash'] },
          total_amount: { $sum: '$total_amount' },
          order_count: { $sum: 1 },
        },
      },
    ]);

    let totalIncome = 0;
    let totalPaidOrders = 0;
    const breakdown = {
      razorpay: { amount: 0, count: 0 },
      counter_cash: { amount: 0, count: 0 },
      counter_upi: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    };

    aggregation.forEach((row) => {
      const method = row._id || 'counter_cash';
      if (!breakdown[method]) breakdown[method] = { amount: 0, count: 0 };
      breakdown[method].amount += row.total_amount;
      breakdown[method].count += row.order_count;
      totalIncome += row.total_amount;
      totalPaidOrders += row.order_count;
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
};

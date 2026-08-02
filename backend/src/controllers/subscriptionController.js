/**
 * DEVELOPER RAZORPAY ACCOUNT ONLY - Used for Canteen Subscription Billing
 * ─────────────────────────────────────────────────────────────────────────
 * This controller handles canteen recurring subscription payments (canteen super_admin -> DEVELOPER).
 * It uses DEV_RAZORPAY_KEY_ID, DEV_RAZORPAY_KEY_SECRET, and DEV_RAZORPAY_WEBHOOK_SECRET.
 * NEVER mix or reference student checkout keys (RAZORPAY_KEY_ID / SECRET) here.
 * NEVER touch Order or OrderItem database tables in this controller.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const SUBSCRIPTION_PLANS = require('../config/subscriptionPlans');

/**
 * Lazy helper to initialize Developer Razorpay instance
 */
const getDevRazorpayInstance = () => {
  const keyId = process.env.DEV_RAZORPAY_KEY_ID;
  const keySecret = process.env.DEV_RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret || keyId === 'rzp_test_DevSubBillingKeyId') {
    return null; // Will trigger mock order mode in development if keys are unconfigured
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/**
 * Get or initialize single-tenant Subscription record.
 * Creates an active default subscription if no record exists yet.
 */
const getOrCreateSubscriptionRecord = async () => {
  let subscription = await prisma.subscription.findFirst({
    orderBy: { id: 'asc' },
  });

  if (!subscription) {
    const now = new Date();
    const defaultEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days active by default

    subscription = await prisma.subscription.create({
      data: {
        plan_type: 'monthly',
        subscription_start_date: now,
        subscription_end_date: defaultEndDate,
        status: 'active',
        last_payment_amount: 1000.0,
        last_payment_date: now,
        dev_razorpay_payment_id: 'init_dev_seed',
      },
    });
  }

  // Reactive expiry check
  const now = new Date();
  if (subscription.subscription_end_date < now && subscription.status === 'active') {
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'expired' },
    });
  }

  return subscription;
};

/**
 * Compute fresh days remaining
 */
const calculateDaysRemaining = (endDate) => {
  const diffMs = new Date(endDate) - new Date();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

/**
 * GET /api/subscription/status
 * Public / Protected endpoint to query subscription status & plans metadata
 */
const getSubscriptionStatusDetails = async (req, res) => {
  try {
    const subscription = await getOrCreateSubscriptionRecord();
    const daysRemaining = calculateDaysRemaining(subscription.subscription_end_date);

    return res.status(200).json({
      success: true,
      subscription: {
        ...subscription,
        days_remaining: daysRemaining,
        is_expired: subscription.status !== 'active' || daysRemaining <= 0,
      },
      plans: SUBSCRIPTION_PLANS,
      dev_razorpay_key_id: process.env.DEV_RAZORPAY_KEY_ID || 'rzp_test_DevSubBillingKeyId',
    });
  } catch (error) {
    console.error('[Subscription Controller] Error fetching status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription status.',
      error: error.message,
    });
  }
};

/**
 * POST /api/subscription/create-order
 * Super Admin creates a Razorpay order using DEVELOPER keys
 */
const createSubscriptionOrder = async (req, res) => {
  try {
    const { plan_type } = req.body;
    const plan = SUBSCRIPTION_PLANS[plan_type];

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan_type '${plan_type}'. Must be one of: monthly, quarterly, six_month, yearly.`,
      });
    }

    const devRazorpay = getDevRazorpayInstance();
    let devRazorpayOrderId = null;

    if (devRazorpay) {
      const rzpOrder = await devRazorpay.orders.create({
        amount: plan.amount_in_paise,
        currency: 'INR',
        receipt: `sub_rcpt_${Date.now()}`,
        notes: {
          plan_type: plan.id,
          plan_name: plan.name,
          duration_days: plan.duration_days,
          type: 'canteen_subscription',
        },
      });
      devRazorpayOrderId = rzpOrder.id;
    } else {
      devRazorpayOrderId = `sub_order_mock_${Date.now()}`;
      console.log(`[Subscription Controller] DEV Razorpay live keys missing; using mock order ID: ${devRazorpayOrderId}`);
    }

    return res.status(200).json({
      success: true,
      dev_razorpay_order_id: devRazorpayOrderId,
      amount: plan.amount_in_paise,
      currency: 'INR',
      key_id: process.env.DEV_RAZORPAY_KEY_ID || 'rzp_test_DevSubBillingKeyId',
      plan: plan,
    });
  } catch (error) {
    console.error('[Subscription Controller] Error creating subscription order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create subscription order with Developer Razorpay account.',
      error: error.message,
    });
  }
};

/**
 * POST /api/subscription/verify-payment
 * Super Admin verifies payment and renews/extends subscription.
 * Uses DEV Razorpay credentials only.
 */
const verifySubscriptionPayment = async (req, res) => {
  try {
    const {
      dev_razorpay_order_id,
      dev_razorpay_payment_id,
      dev_razorpay_signature,
      plan_type,
    } = req.body;

    const plan = SUBSCRIPTION_PLANS[plan_type];
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan_type '${plan_type}'.`,
      });
    }

    const devSecret = process.env.DEV_RAZORPAY_KEY_SECRET;
    let isValidSignature = true;

    if (devSecret && dev_razorpay_signature && !dev_razorpay_order_id?.startsWith('sub_order_mock_')) {
      const generatedSignature = crypto
        .createHmac('sha256', devSecret)
        .update(`${dev_razorpay_order_id}|${dev_razorpay_payment_id}`)
        .digest('hex');

      isValidSignature = generatedSignature === dev_razorpay_signature;
    }

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Developer Razorpay payment signature verification failed.',
      });
    }

    const currentSubscription = await getOrCreateSubscriptionRecord();
    const now = new Date();
    let newStartDate = currentSubscription.subscription_start_date;
    let baseEndDate = currentSubscription.subscription_end_date;

    // RENEWAL RULE:
    // If current subscription is active and end_date is in the future, extend forward from baseEndDate.
    // If current subscription is expired or end_date <= now, start from today (now).
    if (currentSubscription.status !== 'active' || !baseEndDate || baseEndDate < now) {
      newStartDate = now;
      baseEndDate = now;
    }

    const planMs = plan.duration_days * 24 * 60 * 60 * 1000;
    const newEndDate = new Date(baseEndDate.getTime() + planMs);

    const updatedSubscription = await prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        plan_type: plan.id,
        subscription_start_date: newStartDate,
        subscription_end_date: newEndDate,
        status: 'active',
        last_payment_amount: plan.price,
        last_payment_date: now,
        dev_razorpay_payment_id: dev_razorpay_payment_id || `pay_dev_mock_${Date.now()}`,
      },
    });

    const daysRemaining = calculateDaysRemaining(updatedSubscription.subscription_end_date);

    console.log(
      `✅ [Subscription Billing] Successfully renewed subscription! Plan: ${plan.name}, New Expiry: ${newEndDate.toISOString()} (${daysRemaining} days remaining)`
    );

    return res.status(200).json({
      success: true,
      message: 'Subscription successfully renewed and un-suspended!',
      subscription: {
        ...updatedSubscription,
        days_remaining: daysRemaining,
        is_expired: false,
      },
    });
  } catch (error) {
    console.error('[Subscription Controller] Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Subscription payment verification failed.',
      error: error.message,
    });
  }
};

/**
 * POST /api/webhook/razorpay-subscription
 * Webhook for DEVELOPER Razorpay Account
 */
const handleDevRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const devWebhookSecret = process.env.DEV_RAZORPAY_WEBHOOK_SECRET;

    if (devWebhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', devWebhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('[DEV Razorpay Webhook] Invalid signature received.');
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    console.log(`🔔 [DEV Razorpay Webhook] Received event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload?.payment?.entity;
      const notes = paymentEntity?.notes || {};
      const planType = notes.plan_type || 'monthly';
      const plan = SUBSCRIPTION_PLANS[planType] || SUBSCRIPTION_PLANS.monthly;

      const currentSubscription = await getOrCreateSubscriptionRecord();
      const now = new Date();
      let baseEndDate = currentSubscription.subscription_end_date;

      if (currentSubscription.status !== 'active' || !baseEndDate || baseEndDate < now) {
        baseEndDate = now;
      }

      const planMs = plan.duration_days * 24 * 60 * 60 * 1000;
      const newEndDate = new Date(baseEndDate.getTime() + planMs);

      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          plan_type: plan.id,
          subscription_end_date: newEndDate,
          status: 'active',
          last_payment_amount: plan.price,
          last_payment_date: now,
          dev_razorpay_payment_id: paymentEntity?.id || `webhook_pay_${Date.now()}`,
        },
      });

      console.log(`✅ [DEV Razorpay Webhook] Processed subscription renewal via webhook event.`);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[DEV Razorpay Webhook Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/subscription/expire-test (Super Admin testing endpoint to manually force expiration)
 */
const forceExpireSubscriptionTest = async (req, res) => {
  try {
    const currentSubscription = await getOrCreateSubscriptionRecord();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const expiredSubscription = await prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        subscription_end_date: yesterday,
        status: 'expired',
      },
    });

    console.warn('⚠️ [Subscription Test] Subscription manually forced to EXPIRED state for testing.');

    return res.status(200).json({
      success: true,
      message: 'Subscription has been manually expired for testing. All app routes will now return 402 until renewed.',
      subscription: expiredSubscription,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSubscriptionStatusDetails,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  handleDevRazorpayWebhook,
  forceExpireSubscriptionTest,
  getOrCreateSubscriptionRecord,
  calculateDaysRemaining,
};

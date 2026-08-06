/**
 * Global Subscription Status Enforcement Middleware
 * Runs before all routes EXCEPT subscription renewal endpoints, dev webhook, health check, and admin login.
 */

const { getOrCreateSubscriptionRecord } = require('../controllers/subscriptionController');

const checkSubscriptionStatus = async (req, res, next) => {
  const path = req.path || req.originalUrl || '';

  // Excluded route patterns that must remain accessible when subscription is expired/suspended:
  const isExcluded =
    path.startsWith('/api/subscription') ||
    path.startsWith('/subscription') ||
    path.startsWith('/api/webhook/razorpay-subscription') ||
    path.startsWith('/webhook/razorpay-subscription') ||
    path.startsWith('/api/auth/admin') ||
    path.startsWith('/auth/admin') ||
    path.startsWith('/api/owner') ||
    path.startsWith('/owner') ||
    path === '/api/health' ||
    path === '/';

  if (isExcluded) {
    return next();
  }

  try {
    const subscription = await getOrCreateSubscriptionRecord();

    const now = new Date();
    const isExpired = subscription.status !== 'active' || subscription.subscription_end_date < now;

    if (isExpired) {
      return res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        status: subscription.status,
        message: "This canteen's subscription has expired.",
      });
    }

    next();
  } catch (error) {
    console.error('[Subscription Middleware Error]', error);
    // In case of error checking DB, allow request or handle gracefully
    next();
  }
};

module.exports = {
  checkSubscriptionStatus,
};

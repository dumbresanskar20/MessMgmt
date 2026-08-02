/**
 * Canteen Subscription Plans Configuration
 * Fee structure paid by canteen super_admin to the DEVELOPER.
 */

const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'monthly',
    name: 'Monthly Plan',
    price: 1000, // INR
    amount_in_paise: 100000,
    duration_days: 30,
    description: '30 Days Full Access (₹1,000)',
  },
  quarterly: {
    id: 'quarterly',
    name: 'Quarterly Plan',
    price: 3000, // INR
    amount_in_paise: 300000,
    duration_days: 90,
    description: '90 Days Full Access (₹3,000)',
  },
  six_month: {
    id: 'six_month',
    name: '6-Month Plan',
    price: 6000, // INR
    amount_in_paise: 600000,
    duration_days: 180,
    description: '180 Days Full Access (₹6,000)',
  },
  yearly: {
    id: 'yearly',
    name: 'Yearly Plan',
    price: 12000, // INR
    amount_in_paise: 1200000,
    duration_days: 365,
    description: '365 Days Full Access (₹12,000)',
  },
};

module.exports = SUBSCRIPTION_PLANS;

import React, { useState } from 'react';
import { X, Check, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import api from '../services/api';

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly Plan',
    price: 1000,
    days: 30,
    perDay: '₹33.33/day',
    badge: null,
  },
  {
    id: 'quarterly',
    name: 'Quarterly Plan',
    price: 3000,
    days: 90,
    perDay: '₹33.33/day',
    badge: 'Popular',
  },
  {
    id: 'six_month',
    name: '6-Month Plan',
    price: 6000,
    days: 180,
    perDay: '₹33.33/day',
    badge: 'Value',
  },
  {
    id: 'yearly',
    name: 'Yearly Plan',
    price: 12000,
    days: 365,
    perDay: '₹32.87/day',
    badge: 'Best Savings',
  },
];

export default function SubscriptionModal({ isOpen, onClose, onSuccess }) {
  const [selectedPlanId, setSelectedPlanId] = useState('monthly');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // Helper to dynamically inject Razorpay Checkout script if needed
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async () => {
    setProcessing(true);
    setErrorMessage('');

    try {
      const res = await api.post('/subscription/create-order', { plan_type: selectedPlanId });

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to create subscription order');
      }

      const { dev_razorpay_order_id, amount, key_id, plan } = res.data;

      // Handle mock fallback mode in local development when keys aren't real live keys
      if (dev_razorpay_order_id.startsWith('sub_order_mock_')) {
        console.log('[Subscription Checkout] Mock order detected, performing instant dev verification');
        const verifyRes = await api.post('/subscription/verify-payment', {
          dev_razorpay_order_id,
          dev_razorpay_payment_id: `pay_dev_mock_${Date.now()}`,
          dev_razorpay_signature: 'mock_dev_sig',
          plan_type: selectedPlanId,
        });

        if (verifyRes.data.success) {
          if (onSuccess) onSuccess(verifyRes.data.subscription);
          onClose();
        } else {
          setErrorMessage(verifyRes.data.message || 'Mock verification failed');
        }
        setProcessing(false);
        return;
      }

      // Load SDK
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setErrorMessage('Failed to load Razorpay SDK. Check your internet connection.');
        setProcessing(false);
        return;
      }

      const options = {
        key: key_id,
        amount: amount,
        currency: 'INR',
        name: 'Mess Management System',
        description: `Canteen Application Subscription - ${plan.name}`,
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80',
        order_id: dev_razorpay_order_id,
        handler: async (response) => {
          try {
            const verifyRes = await api.post('/subscription/verify-payment', {
              dev_razorpay_order_id: response.razorpay_order_id,
              dev_razorpay_payment_id: response.razorpay_payment_id,
              dev_razorpay_signature: response.razorpay_signature,
              plan_type: selectedPlanId,
            });

            if (verifyRes.data.success) {
              if (onSuccess) onSuccess(verifyRes.data.subscription);
              onClose();
            } else {
              setErrorMessage(verifyRes.data.message || 'Payment verification failed.');
            }
          } catch (err) {
            console.error('Subscription verification error:', err);
            setErrorMessage(err.response?.data?.message || 'Payment verification error.');
          } finally {
            setProcessing(false);
          }
        },
        prefill: {
          name: 'Canteen Super Admin',
          email: 'admin@canteen.com',
        },
        theme: {
          color: '#F97316',
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error('Create subscription order error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Payment processing error.');
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 text-white relative shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-extrabold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
            <span>Developer Subscription Billing</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Renew Canteen App Subscription
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Select a plan to extend or reactivate application access. Payment goes directly to the developer account.
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`cursor-pointer rounded-2xl p-5 border transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                {plan.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'bg-amber-500 border-amber-500 text-slate-950'
                          : 'border-slate-600 bg-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className="font-bold text-sm text-white">{plan.name}</span>
                  </div>

                  <div className="pt-2">
                    <span className="text-2xl font-black text-white">
                      ₹{plan.price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">/ {plan.days} days</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Full App Access</span>
                  <span className="text-amber-400 font-bold">{plan.perDay}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Safeguard Notice */}
        <div className="mb-6 p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Dual Razorpay Security Isolation</span>
          </div>
          <p>
            Subscription payments hit the Developer's Razorpay account exclusively and do not alter canteen meal sales or income records.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubscribe}
            disabled={processing}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95"
          >
            {processing ? (
              <span>Initiating Razorpay...</span>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Pay ₹{PLANS.find((p) => p.id === selectedPlanId)?.price.toLocaleString('en-IN')} & Reactivate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

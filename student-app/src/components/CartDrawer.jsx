import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { loadRazorpayScript } from '../utils/loadRazorpay';

export default function CartDrawer({ onOrderSuccess }) {
  const { cartItems, cartTotal, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, selectedMealType, clearCart } = useCart();
  const { student, isAuthenticated, openAuthModal } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isCartOpen) return null;

  const handleProceedToPay = async () => {
    setErrorMessage('');

    // Check auth boundary: If user is not logged in, prompt Auth Modal and preserve cart
    if (!isAuthenticated) {
      openAuthModal(true); // Passes forCheckout = true so login triggers payment on success
      return;
    }

    if (cartItems.length === 0) return;

    setCheckoutLoading(true);

    try {
      // 1. Verify VITE_RAZORPAY_KEY_ID availability
      const frontendKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      console.log(
        '[Razorpay Diagnostics] 1. Checking Frontend VITE_RAZORPAY_KEY_ID:',
        frontendKey ? `${frontendKey.substring(0, 10)}...` : 'MISSING / UNDEFINED'
      );

      if (!frontendKey || frontendKey === 'rzp_test_YourKeyIdHere') {
        console.warn(
          '[Razorpay Diagnostics] Warning: VITE_RAZORPAY_KEY_ID is missing or set to placeholder string in Vercel environment variables!'
        );
      }

      // 2. Verify Razorpay Checkout.js SDK script loading
      console.log('[Razorpay Diagnostics] 2. Verifying Razorpay Checkout SDK script presence...');
      const scriptReady = await loadRazorpayScript();

      if (!scriptReady || typeof window.Razorpay === 'undefined') {
        console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
        setErrorMessage('Razorpay SDK failed to load — check network connection or ad-blocker extension.');
        setCheckoutLoading(false);
        return;
      }

      // 3. Request backend Razorpay Order creation (Backend validates item availability & prices)
      console.log('[Razorpay Diagnostics] 3. Calling backend /orders/create-razorpay-order...', {
        itemsCount: cartItems.length,
        meal_type: selectedMealType,
        cartTotal,
      });

      const res = await api.post('/orders/create-razorpay-order', {
        items: cartItems,
        meal_type: selectedMealType,
      });

      console.log('[Razorpay Diagnostics] 4. Backend order creation response received:', res.data);

      const { razorpay_order_id, amount, currency, key_id, order_db_id } = res.data;

      if (!razorpay_order_id) {
        throw new Error('Backend response did not contain a valid Razorpay Order ID.');
      }

      const activeKey = key_id || frontendKey;

      // 4. Configure Razorpay SDK Checkout options
      const options = {
        key: activeKey,
        amount: amount,
        currency: currency || 'INR',
        name: 'Campus Mess Canteen',
        description: `${selectedMealType.toUpperCase()} Meal Order Token`,
        order_id: razorpay_order_id.startsWith('order_mock_') ? undefined : razorpay_order_id,
        handler: async function (response) {
          console.log('[Razorpay Diagnostics] Payment succeeded on client, verifying signature with backend...', response);
          try {
            // Verify Payment Signature & Fulfill Order Token
            const verifyRes = await api.post('/orders/verify-payment', {
              razorpay_order_id: response.razorpay_order_id || razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id || `pay_mock_${Date.now()}`,
              razorpay_signature: response.razorpay_signature || 'mock_signature',
              order_db_id: order_db_id,
            });

            console.log('[Razorpay Diagnostics] Payment verification response:', verifyRes.data);

            if (verifyRes.data.success) {
              clearCart(); // Clear cart ONLY on successful checkout
              setIsCartOpen(false);
              onOrderSuccess(verifyRes.data.token_number, verifyRes.data.order);
            } else {
              setErrorMessage(verifyRes.data.message || 'Payment verification failed.');
            }
          } catch (verifyErr) {
            console.error('[Razorpay Diagnostics] Payment verification error:', verifyErr);
            setErrorMessage(verifyErr.response?.data?.message || 'Payment verification failed. Please check your order status.');
          } finally {
            setCheckoutLoading(false);
          }
        },
        prefill: {
          name: student?.name || 'Student',
          email: student?.email || 'student@mess.com',
        },
        theme: {
          color: '#ea580c',
        },
        modal: {
          ondismiss: function () {
            console.log('[Razorpay Diagnostics] Checkout modal dismissed by user.');
            setCheckoutLoading(false);
          },
        },
      };

      // 5. Instantiate and launch Razorpay Checkout window
      if (typeof window.Razorpay !== 'undefined' && !razorpay_order_id.startsWith('order_mock_')) {
        console.log(`[Razorpay Diagnostics] 5. Instantiating Razorpay modal with Order ID: ${razorpay_order_id}`);
        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', function (failureResponse) {
          console.error('[Razorpay Diagnostics] Razorpay Payment Failed Event:', failureResponse.error);
          setErrorMessage(`Payment failed: ${failureResponse.error?.description || failureResponse.error?.reason || 'Transaction aborted.'}`);
          setCheckoutLoading(false);
        });

        rzp.open();
      } else if (razorpay_order_id.startsWith('order_mock_')) {
        console.warn('[Razorpay Diagnostics] Local dev mock order ID received. Simulating sandbox fulfillment...');
        // Dev Sandbox Simulation fallback when test keys aren't live
        setTimeout(async () => {
          try {
            const verifyRes = await api.post('/orders/verify-payment', {
              razorpay_order_id: razorpay_order_id,
              razorpay_payment_id: `pay_sandbox_${Date.now()}`,
              razorpay_signature: 'sandbox_test_sig',
              order_db_id: order_db_id,
            });

            if (verifyRes.data.success) {
              clearCart(); // Clear cart ONLY on successful checkout
              setIsCartOpen(false);
              onOrderSuccess(verifyRes.data.token_number, verifyRes.data.order);
            }
          } catch (e) {
            setErrorMessage('Sandbox order fulfillment failed.');
          } finally {
            setCheckoutLoading(false);
          }
        }, 1000);
      } else {
        console.error('[Razorpay Diagnostics] Razorpay SDK failed to load — check network/ad-blocker');
        setErrorMessage('Razorpay SDK failed to load — check network connection or ad-blocker.');
        setCheckoutLoading(false);
      }
    } catch (err) {
      console.error('[Razorpay Diagnostics] Checkout initiation failed:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to initiate Razorpay order.');
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-amber-100 animate-in slide-in-from-right duration-300">
          
          {/* Drawer Header */}
          <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-100 text-brand-orange rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-extrabold text-lg text-brand-dark">Your Meal Tray</h2>
                <p className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">
                  Target Meal: <span className="text-brand-orange">{selectedMealType}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Items Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-4xl mb-4 animate-bounce">
                  🍽️
                </div>
                <h3 className="font-display font-bold text-lg text-stone-800">Your tray is empty — let's fix that!</h3>
                <p className="text-xs text-stone-500 max-w-xs mt-1">
                  Explore fresh dosa, thalis, and biryani on the menu and tap 'Add to Tray'.
                </p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 p-3.5 bg-stone-50/80 rounded-2xl border border-stone-100 hover:border-amber-200 transition-all"
                >
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-xl shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-brand-dark truncate">{item.name}</h4>
                    <p className="text-xs font-display font-extrabold text-brand-orange mt-0.5">₹{item.price}</p>
                  </div>

                  {/* Quantity Counter */}
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-stone-200 shadow-xs">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1 text-stone-500 hover:text-brand-orange"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-stone-800 w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1 text-stone-500 hover:text-brand-orange"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer & Checkout CTA */}
          {cartItems.length > 0 && (
            <div className="p-5 border-t border-stone-100 bg-white space-y-4">
              <div className="space-y-1.5 text-xs text-stone-600 font-medium">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{cartTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes & Canteen Handling</span>
                  <span className="text-emerald-600 font-bold">FREE</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold font-display text-brand-dark pt-2 border-t border-stone-100">
                  <span>Total Payable</span>
                  <span className="text-brand-orange text-lg">₹{cartTotal}</span>
                </div>
              </div>

              {/* Direct Razorpay Checkout Action */}
              <button
                onClick={handleProceedToPay}
                disabled={checkoutLoading}
                className="w-full py-3.5 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-extrabold rounded-2xl text-sm shadow-warm hover:shadow-cardHover transition-all flex items-center justify-center gap-2"
              >
                {checkoutLoading ? (
                  <span>Initiating Razorpay...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Proceed to Pay (₹{cartTotal})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

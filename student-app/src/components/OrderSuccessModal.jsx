import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, X, Clock, Receipt, Utensils } from 'lucide-react';

export default function OrderSuccessModal({ tokenNumber, order, onClose }) {
  useEffect(() => {
    if (tokenNumber) {
      // Fire confetti burst upon token reveal
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ea580c', '#f59e0b', '#10b981', '#ffffff'],
        });
      } catch (e) {
        console.log('Confetti error:', e);
      }
    }
  }, [tokenNumber]);

  if (!tokenNumber) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 p-6 text-center animate-in zoom-in-95">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Animated Check Icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <h2 className="text-2xl font-extrabold font-display text-brand-dark">Payment Confirmed!</h2>
        <p className="text-xs text-stone-500 mt-1">Show this token number at the canteen counter</p>

        {/* Prominent Token Card */}
        <div className="my-6 p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-dashed border-amber-300 shadow-inner">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-widest block mb-1">
            Your Daily Token Number
          </span>
          <div className="text-5xl font-extrabold font-display text-brand-terracotta tracking-wider animate-pulse">
            {tokenNumber}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mt-3">
            <Clock className="w-3 h-3" /> Preparing in Kitchen
          </span>
        </div>

        {/* Order Details Brief */}
        {order && (
          <div className="text-left text-xs bg-stone-50 p-3.5 rounded-2xl border border-stone-100 space-y-1.5 mb-6">
            <div className="flex justify-between text-stone-500">
              <span>Meal Type:</span>
              <span className="font-bold text-stone-800 uppercase">{order.meal_type}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Total Amount:</span>
              <span className="font-bold text-brand-orange">₹{order.total_amount}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Date:</span>
              <span className="font-medium text-stone-700">{order.date}</span>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-brand-dark text-white font-bold rounded-2xl text-xs hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
        >
          <Utensils className="w-4 h-4" />
          <span>Done & Back to Menu</span>
        </button>

      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, X, Clock, Utensils } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function OrderSuccessModal({ tokenNumber, order, onClose }) {
  useEffect(() => {
    if (tokenNumber) {
      // Fire confetti burst upon confirmed token reveal
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

  if (!tokenNumber && !order) return null;

  const qrPayload = tokenNumber
    ? JSON.stringify({
        order_id: order?._id || order?.id || '',
        token_number: tokenNumber,
        meal_type: order?.meal_type || '',
        payment_status: order?.payment_status || 'paid',
        date: order?.date || '',
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in overflow-hidden">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 p-4 sm:p-6 text-center animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Paid Token Icon */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 animate-bounce">
          <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold font-display text-brand-dark">Payment Confirmed!</h2>
        <p className="text-xs text-stone-500 mt-1">Show this token or QR code at the canteen counter</p>

        {/* Prominent Token & QR Card */}
        <div className="my-4 p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-dashed border-amber-300 shadow-inner flex flex-col items-center space-y-2.5">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">
            Your Daily Token Number
          </span>
          
          <div className="text-4xl sm:text-5xl font-extrabold font-display text-brand-terracotta tracking-wider animate-pulse">
            {tokenNumber}
          </div>

          {/* QR Code */}
          {qrPayload && (
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-amber-200 inline-block my-1">
              <QRCodeSVG
                value={qrPayload}
                size={120}
                level="M"
                fgColor="#1c1917"
                bgColor="#ffffff"
              />
            </div>
          )}
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
            Scan at Counter for Pickup
          </span>

          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
            <Clock className="w-3 h-3" /> Preparing in Kitchen
          </span>
        </div>

        {/* Order Details Brief */}
        {order && (
          <div className="text-left text-xs bg-stone-50 p-3 sm:p-3.5 rounded-2xl border border-stone-100 space-y-1.5 mb-5">
            <div className="flex justify-between text-stone-500">
              <span>Meal Type:</span>
              <span className="font-bold text-stone-800 uppercase">{order.meal_type}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Status:</span>
              <span className="font-extrabold uppercase px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">
                Paid
              </span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Total Amount:</span>
              <span className="font-bold text-brand-orange">₹{order.total_amount}</span>
            </div>
            
            {/* Itemized list */}
            {order.items && order.items.length > 0 && (
              <div className="border-t border-stone-200/80 pt-1.5 space-y-1">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-stone-700 font-semibold min-w-0 gap-2">
                    <span className="truncate">{it.quantity}x {it.item_name}</span>
                    <span className="shrink-0">₹{it.price * it.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-brand-dark text-white font-bold rounded-2xl text-xs hover:bg-stone-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Utensils className="w-4 h-4" />
          <span>Done & Back to Menu</span>
        </button>

      </div>
    </div>
  );
}

import React from 'react';
import { X, CheckCircle2, Clock, Store, AlertCircle, ShoppingBag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function OrderDetailModal({ order, onClose }) {
  if (!order) return null;

  const isDelivered = order.order_status === 'delivered';
  const isAwaiting = order.payment_status === 'awaiting_counter_payment';
  const tokenNumber = order.token_number;

  const qrData = tokenNumber
    ? JSON.stringify({
        order_id: order._id || order.id || '',
        token_number: tokenNumber,
        meal_type: order.meal_type || '',
        payment_status: order.payment_status || 'paid',
        date: order.date || '',
      })
    : '';

  const getStatusBadge = () => {
    if (isAwaiting) {
      return (
        <span className="bg-amber-100 text-amber-900 text-xs font-extrabold px-3 py-1 rounded-full uppercase flex items-center gap-1">
          <Store className="w-3.5 h-3.5" /> Awaiting Counter Payment
        </span>
      );
    }
    if (isDelivered) {
      return (
        <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
        </span>
      );
    }
    return (
      <span className="bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" /> {order.order_status || 'Placed'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 p-6 text-center animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header info */}
        <div className="mb-4">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest block">
            Order Details
          </span>
          <div className="mt-1 flex items-center justify-center gap-2">
            {getStatusBadge()}
          </div>
        </div>

        {/* Large Token & QR Box */}
        {tokenNumber && !isAwaiting && (
          <div className="my-4 p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-dashed border-amber-300 shadow-inner flex flex-col items-center space-y-3">
            <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-widest">
              Daily Token Number
            </span>

            <div className="text-5xl font-black font-display text-brand-terracotta tracking-wider">
              {tokenNumber}
            </div>

            {/* Large Scannable QR Code */}
            <div className="relative my-2">
              <div
                className={`p-4 bg-white rounded-3xl shadow-md border border-amber-200 inline-block transition-all ${
                  isDelivered ? 'grayscale opacity-30 select-none' : ''
                }`}
              >
                <QRCodeSVG
                  value={qrData}
                  size={210}
                  level="M"
                  fgColor="#1c1917"
                  bgColor="#ffffff"
                />
              </div>

              {/* Overlay Badge for Delivered Orders */}
              {isDelivered && (
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <div className="px-4 py-2.5 bg-emerald-600 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-2xl border-2 border-white flex items-center gap-1.5 tracking-wide animate-in zoom-in">
                    <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                    <span>✅ ALREADY DELIVERED</span>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] font-semibold text-stone-500 max-w-xs leading-tight">
              {isDelivered
                ? 'This order has already been picked up and delivered.'
                : 'Show this large QR code at the canteen counter for quick pickup.'}
            </p>
          </div>
        )}

        {/* Awaiting Payment Notice */}
        {isAwaiting && (
          <div className="my-4 p-5 bg-amber-50 rounded-3xl border-2 border-dashed border-amber-300 space-y-2">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
              Payment Pending at Counter
            </span>
            <div className="text-3xl font-black text-brand-dark">₹{order.total_amount}</div>
            <p className="text-[11px] text-amber-800 font-medium">
              Please pay ₹{order.total_amount} at the counter. Once staff confirms payment, your token number & QR code will appear here.
            </p>
          </div>
        )}

        {/* Items Summary Breakdown */}
        <div className="text-left bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-2.5 mb-5 text-xs">
          <div className="flex justify-between font-bold text-stone-700 pb-2 border-b border-stone-200/80">
            <span>Meal Category: <span className="uppercase text-brand-terracotta">{order.meal_type}</span></span>
            <span>Date: {order.date}</span>
          </div>

          <div className="space-y-1.5">
            {(order.items || []).map((it, idx) => (
              <div key={idx} className="flex justify-between text-stone-700 font-semibold">
                <span>{it.quantity}x {it.item_name}</span>
                <span>₹{it.price * it.quantity}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-stone-200/80 pt-2 flex justify-between font-black text-sm text-stone-900">
            <span>Total Amount</span>
            <span className="text-brand-orange">₹{order.total_amount}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 bg-brand-dark text-white font-extrabold rounded-2xl text-xs hover:bg-stone-800 transition-all cursor-pointer shadow-md"
        >
          Close Details
        </button>

      </div>
    </div>
  );
}

import React from 'react';
import { X, CheckCircle2, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function OrderDetailModal({ order, onClose }) {
  if (!order) return null;

  const isDelivered = order.order_status === 'delivered';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-md animate-in fade-in overflow-hidden">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200 p-4 sm:p-6 text-center animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header info */}
        <div className="mb-3">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest block">
            Order Details
          </span>
          <div className="mt-1 flex items-center justify-center gap-2">
            {getStatusBadge()}
          </div>
        </div>

        {/* Large Token & QR Box */}
        {tokenNumber && (
          <div className="my-3 p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-dashed border-amber-300 shadow-inner flex flex-col items-center space-y-2.5">
            <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-widest">
              Daily Token Number
            </span>

            <div className="text-4xl sm:text-5xl font-black font-display text-brand-terracotta tracking-wider">
              {tokenNumber}
            </div>

            {/* Large Scannable QR Code */}
            <div className="relative my-1">
              <div
                className={`p-3 sm:p-4 bg-white rounded-3xl shadow-md border border-amber-200 inline-block transition-all ${
                  isDelivered ? 'grayscale opacity-30 select-none' : ''
                }`}
              >
                <QRCodeSVG
                  value={qrData}
                  size={180}
                  level="M"
                  fgColor="#1c1917"
                  bgColor="#ffffff"
                />
              </div>

              {/* Overlay Badge for Delivered Orders */}
              {isDelivered && (
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <div className="px-3.5 py-2 bg-emerald-600 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-2xl border-2 border-white flex items-center gap-1.5 tracking-wide animate-in zoom-in">
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                    <span>ALREADY DELIVERED</span>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[10px] sm:text-[11px] font-semibold text-stone-500 max-w-xs leading-tight">
              {isDelivered
                ? 'This order has already been picked up and delivered.'
                : 'Show this large QR code at the canteen counter for quick pickup.'}
            </p>
          </div>
        )}

        {/* Items Summary Breakdown */}
        <div className="text-left bg-stone-50 p-3.5 sm:p-4 rounded-2xl border border-stone-200/80 space-y-2 mb-4 text-xs">
          <div className="flex justify-between font-bold text-stone-700 pb-2 border-b border-stone-200/80">
            <span>Meal: <span className="uppercase text-brand-terracotta">{order.meal_type}</span></span>
            <span>Date: {order.date}</span>
          </div>

          <div className="space-y-1">
            {(order.items || []).map((it, idx) => (
              <div key={idx} className="flex justify-between text-stone-700 font-semibold min-w-0 gap-2">
                <span className="truncate">{it.quantity}x {it.item_name}</span>
                <span className="shrink-0">₹{it.price * it.quantity}</span>
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
          className="w-full py-3 bg-brand-dark text-white font-extrabold rounded-2xl text-xs hover:bg-stone-800 transition-all cursor-pointer shadow-md"
        >
          Close Details
        </button>

      </div>
    </div>
  );
}

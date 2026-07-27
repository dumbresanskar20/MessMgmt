import React, { useState, useEffect } from 'react';
import { X, Receipt, Clock, CheckCircle2, AlertCircle, Store } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

export default function OrderHistoryModal({ isOpen, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/my-orders');
      if (res.data.success) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error('Error fetching order history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusBadge = (ord) => {
    if (ord.payment_status === 'awaiting_counter_payment') {
      return (
        <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase flex items-center gap-1">
          <Store className="w-3 h-3" />
          Pay at Counter
        </span>
      );
    }

    switch (ord.order_status) {
      case 'placed':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Placed</span>;
      case 'preparing':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase animate-pulse">Preparing</span>;
      case 'ready':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Ready for Pickup</span>;
      case 'delivered':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Delivered</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">{ord.order_status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-100 p-6 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-brand-orange rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-lg text-brand-dark">My Order Tokens</h2>
              <p className="text-[11px] text-stone-500 font-medium">Real-time status of your canteen meal orders</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Orders List Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5">
          {loading ? (
            <div className="text-center py-12 text-stone-400 text-xs font-semibold">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-xs font-medium">
              You haven't placed any meal orders yet!
            </div>
          ) : (
            orders.map((ord) => {
              const isAwaiting = ord.payment_status === 'awaiting_counter_payment';
              const qrData = ord.token_number
                ? JSON.stringify({
                    order_id: ord._id,
                    token_number: ord.token_number,
                    meal_type: ord.meal_type,
                    payment_status: ord.payment_status,
                    date: ord.date,
                  })
                : '';

              return (
                <div
                  key={ord._id}
                  className="p-4 bg-stone-50/80 rounded-2xl border border-stone-200/80 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {isAwaiting ? (
                        <div className="px-3 py-2 bg-amber-100 text-amber-900 font-extrabold text-xs rounded-xl border border-amber-200 text-center">
                          Awaiting Payment
                        </div>
                      ) : (
                        <div className="font-display font-extrabold text-xl text-brand-terracotta bg-amber-100/80 px-3 py-1 rounded-xl">
                          {ord.token_number || 'Pending'}
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-stone-800 uppercase block">{ord.meal_type}</span>
                        <span className="text-[10px] text-stone-400">{ord.date}</span>
                      </div>
                    </div>

                    {getStatusBadge(ord)}
                  </div>

                  {isAwaiting && (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Please pay ₹{ord.total_amount} at the canteen counter to receive your token.</span>
                    </div>
                  )}

                  {/* QR Code for Paid Tokens */}
                  {!isAwaiting && ord.token_number && (
                    <div className="flex items-center gap-4 p-2.5 bg-white rounded-xl border border-stone-200/60">
                      <QRCodeSVG value={qrData} size={70} level="M" />
                      <div className="text-[11px] text-stone-500 font-medium">
                        <span className="font-bold text-stone-800 block">Pickup QR Code</span>
                        Show/scan at counter when picking up your meal token.
                      </div>
                    </div>
                  )}

                  {/* Items list */}
                  <div className="border-t border-stone-200/60 pt-2 space-y-1">
                    {ord.items?.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-stone-600 font-medium">
                        <span>{it.item_name} × {it.quantity}</span>
                        <span>₹{it.price * it.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1 text-stone-500 font-semibold">
                    <span>
                      {isAwaiting
                        ? 'Payment: Pending at Counter'
                        : ord.razorpay_payment_id
                        ? 'Paid via Razorpay'
                        : 'Paid at Counter'}
                    </span>
                    <span className="text-brand-orange font-extrabold text-sm">Total: ₹{ord.total_amount}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}

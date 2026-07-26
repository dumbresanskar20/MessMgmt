import React, { useState, useEffect } from 'react';
import { X, Receipt, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'placed':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Placed</span>;
      case 'preparing':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase animate-pulse">Preparing</span>;
      case 'ready':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Ready for Pickup</span>;
      case 'delivered':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">Delivered</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">{status}</span>;
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
            orders.map((ord) => (
              <div
                key={ord._id}
                className="p-4 bg-stone-50/80 rounded-2xl border border-stone-200/80 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-extrabold text-xl text-brand-terracotta bg-amber-100/80 px-3 py-1 rounded-xl">
                      {ord.token_number || 'B-000'}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-stone-800 uppercase block">{ord.meal_type}</span>
                      <span className="text-[10px] text-stone-400">{ord.date}</span>
                    </div>
                  </div>

                  {getStatusBadge(ord.order_status)}
                </div>

                <div className="border-t border-stone-200/60 pt-2 space-y-1">
                  {ord.items?.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-stone-600 font-medium">
                      <span>{it.item_name} × {it.quantity}</span>
                      <span>₹{it.price * it.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs pt-1 text-stone-500 font-semibold">
                  <span>Paid via Razorpay</span>
                  <span className="text-brand-orange font-extrabold text-sm">Total: ₹{ord.total_amount}</span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

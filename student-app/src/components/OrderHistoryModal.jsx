import React, { useState, useEffect } from 'react';
import { X, Receipt, CheckCircle2, Maximize2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';
import OrderDetailModal from './OrderDetailModal';

export default function OrderHistoryModal({ isOpen, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);

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
    switch (ord.order_status) {
      case 'placed':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">Placed</span>;
      case 'preparing':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase animate-pulse shrink-0">Preparing</span>;
      case 'ready':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">Ready</span>;
      case 'delivered':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0"><CheckCircle2 className="w-3 h-3" /> Delivered</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">{ord.order_status}</span>;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in overflow-hidden">
        <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-100 p-4 sm:p-6 flex flex-col max-h-[88vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-stone-100 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-amber-100 text-brand-orange rounded-xl shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-extrabold text-base sm:text-lg text-brand-dark truncate">My Order Tokens</h2>
                <p className="text-[10px] sm:text-[11px] text-stone-500 font-medium truncate">Tap any order to view large scannable QR code</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer shrink-0 ml-2"
              aria-label="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Orders List Body */}
          <div className="flex-1 overflow-y-auto py-3.5 space-y-3">
            {loading ? (
              <div className="text-center py-12 text-stone-400 text-xs font-semibold">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-stone-500 text-xs font-medium">
                You haven't placed any meal orders yet!
              </div>
            ) : (
              orders.map((ord) => {
                const isDelivered = ord.order_status === 'delivered';
                const qrData = ord.token_number
                  ? JSON.stringify({
                      order_id: ord._id || ord.id,
                      token_number: ord.token_number,
                      meal_type: ord.meal_type,
                      payment_status: ord.payment_status,
                      date: ord.date,
                    })
                  : '';

                return (
                  <div
                    key={ord._id || ord.id}
                    onClick={() => setSelectedDetailOrder(ord)}
                    className="p-3.5 bg-stone-50/90 hover:bg-amber-50/40 hover:border-amber-300 rounded-2xl border border-stone-200/80 space-y-2.5 transition-all cursor-pointer shadow-sm group min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="font-display font-extrabold text-lg sm:text-xl text-brand-terracotta bg-amber-100/80 px-2.5 py-1 rounded-xl shrink-0">
                          {ord.token_number || 'Pending'}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-stone-800 uppercase block truncate">{ord.meal_type}</span>
                          <span className="text-[10px] text-stone-400 block truncate">{ord.date}</span>
                        </div>
                      </div>

                      {getStatusBadge(ord)}
                    </div>

                    {/* QR Code Card Thumbnail */}
                    {ord.token_number && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200/80 group-hover:border-amber-200 transition-colors gap-2 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`relative shrink-0 ${isDelivered ? 'grayscale opacity-35' : ''}`}>
                            <QRCodeSVG value={qrData} size={52} level="M" />
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-stone-600 font-medium min-w-0">
                            <span className="font-bold text-stone-900 block truncate">
                              {isDelivered ? '✅ Delivered' : 'Pickup QR Code'}
                            </span>
                            <span className="text-[10px] text-stone-400 block truncate">
                              {isDelivered ? 'Redeemed' : 'Tap to view full QR code'}
                            </span>
                          </div>
                        </div>
                        <Maximize2 className="w-4 h-4 text-stone-400 group-hover:text-brand-orange transition-colors shrink-0" />
                      </div>
                    )}

                    {/* Items list summary */}
                    <div className="border-t border-stone-200/60 pt-2 space-y-1">
                      {ord.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-stone-600 font-medium min-w-0 gap-2">
                          <span className="truncate">{it.item_name} × {it.quantity}</span>
                          <span className="shrink-0">₹{it.price * it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1 text-stone-500 font-semibold border-t border-stone-100">
                      <span>Paid via Razorpay</span>
                      <span className="text-brand-orange font-extrabold text-sm">Total: ₹{ord.total_amount}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* Render Large Order Details Modal */}
      {selectedDetailOrder && (
        <OrderDetailModal
          order={selectedDetailOrder}
          onClose={() => setSelectedDetailOrder(null)}
        />
      )}
    </>
  );
}

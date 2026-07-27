import React, { useState, useEffect } from 'react';
import { Store, RefreshCw, Check, Clock, User, AlertCircle, Sparkles } from 'lucide-react';
import api from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { createAdminSocketClient } from '../services/socket';

export default function PendingCounterPayments() {
  const { token } = useAdminAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchPendingOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/pending-counter-payments');
      if (res.data.success) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      console.error('Error fetching pending counter orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingOrders();

    const socket = createAdminSocketClient(token);

    socket.on('connect', () => {
      socket.emit('join:kitchen');
    });

    // Real-time listener for new counter order requests submitted by students
    socket.on('counter:order_requested', (newReq) => {
      console.log('[Socket] New counter payment request received:', newReq);
      fetchPendingOrders();
    });

    // Listener for order status changes
    socket.on('order-counts-updated', () => {
      fetchPendingOrders();
    });

    const interval = setInterval(() => {
      fetchPendingOrders();
    }, 15000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [token]);

  const handleMarkPaid = async (orderId) => {
    if (processingId) return; // Prevent concurrent/double clicks
    setProcessingId(orderId);

    // Optimistically remove from pending list
    const previousOrders = [...orders];
    setOrders((prev) => prev.filter((o) => (o._id || o.id) !== orderId));

    try {
      const res = await api.patch(`/orders/mark-counter-paid/${orderId}`);
      if (res.data.success) {
        console.log(`[Counter Paid Success] Generated Token: ${res.data.token_number}`);
      } else {
        alert(res.data.message || 'Failed to mark payment as paid.');
        setOrders(previousOrders);
      }
    } catch (err) {
      console.error('Error marking counter payment paid:', err);
      alert(err.response?.data?.message || 'Failed to confirm counter payment. Please check your network.');
      setOrders(previousOrders);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-screen-2xl mx-auto">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl">💵</span>
            <span>Pending Counter Payments</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Accept cash/UPI at counter & mark paid to generate tokens • Sorted oldest first
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchPendingOrders}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <span className="bg-amber-100 text-amber-900 font-black text-xs px-3.5 py-2 rounded-2xl border border-amber-200">
            {orders.length} Pending Requests
          </span>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
            Loading pending counter payment requests...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto">
              ✨
            </div>
            <h4 className="text-slate-800 font-bold text-lg">No pending counter payment requests!</h4>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              When students click "Pay at Counter" in the app, their requests will appear here live.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((ord) => {
              const studentName = ord.student_id?.name || 'Student';
              const rollNo = ord.student_id?.roll_no || '';
              const orderId = ord._id || ord.id;
              const isProcessing = processingId === orderId;

              return (
                <div
                  key={orderId}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-slate-50/80 transition-colors"
                >
                  {/* Left: Student & Order Info */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-black text-lg text-slate-900">
                        {studentName}
                      </span>
                      {rollNo && (
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                          Roll: {rollNo}
                        </span>
                      )}
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900">
                        {ord.meal_type}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium ml-auto lg:ml-0">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Requested at {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Items List Breakdown */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(ord.items || []).map((it, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 bg-slate-100/90 rounded-xl text-xs font-bold text-slate-800 border border-slate-200/80 flex items-center gap-1.5"
                        >
                          <span>{it.quantity}x {it.item_name}</span>
                          <span className="text-[10px] text-slate-500 font-semibold">₹{it.price * it.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Amount & CTA */}
                  <div className="flex items-center gap-5 shrink-0 self-end lg:self-center border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 w-full lg:w-auto justify-between lg:justify-end">
                    <div className="text-left lg:text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Amount Due
                      </span>
                      <span className="text-2xl font-black text-brand-orange">
                        ₹{ord.total_amount}
                      </span>
                    </div>

                    <button
                      onClick={() => handleMarkPaid(orderId)}
                      disabled={isProcessing}
                      className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-5 h-5 stroke-[3]" />
                      <span>{isProcessing ? 'MARKING PAID...' : 'MARK AS PAID'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

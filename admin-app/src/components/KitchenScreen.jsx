import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Clock, ChefHat, Check } from 'lucide-react';
import api from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function KitchenScreen() {
  const { token } = useAdminAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'all' | 'delivered'

  // Fetch kitchen orders from API
  const fetchOrders = async () => {
    try {
      let url = '/orders/kitchen-orders?date=' + new Date().toISOString().split('T')[0];
      if (selectedMeal) url += `&meal_type=${selectedMeal}`;
      const res = await api.get(url);
      if (res.data.success) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error('Kitchen orders fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Setup Socket.IO real-time subscription with 15s polling fallback
  useEffect(() => {
    fetchOrders();

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join:kitchen');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('order:new', (newOrder) => {
      setOrders((prev) => [newOrder, ...prev.filter((o) => o._id !== newOrder.id && o._id !== newOrder._id)]);
    });

    socket.on('order:status_updated', ({ orderId, order_status }) => {
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, order_status } : o))
      );
    });

    // 15-second Auto-Polling Fallback in case socket drops in a busy kitchen
    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [token, selectedMeal]);

  // Update order status (big tap target action)
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      // Optimistic state update for instant UI feedback
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, order_status: newStatus } : o))
      );
      await api.patch(`/orders/status/${orderId}`, { order_status: newStatus });
    } catch (err) {
      console.error('Error updating order status:', err);
      fetchOrders(); // Revert on failure
    }
  };

  // Filter logic
  const filteredOrders = orders.filter((ord) => {
    if (statusFilter === 'active') {
      return ['placed', 'preparing', 'ready'].includes(ord.order_status);
    }
    if (statusFilter === 'delivered') {
      return ord.order_status === 'delivered';
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      
      {/* Top Banner with Real-time Socket Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🔥 Kitchen Display System</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Live Token Grid for Canteen Counter • Today: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-3">
          {/* Socket Connection Badge */}
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border ${
            connected
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-amber-50 border-amber-300 text-amber-800 animate-pulse'
          }`}>
            {connected ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-amber-600" />}
            <span>{connected ? 'Live Socket Connected' : 'Reconnecting... (15s Fallback Active)'}</span>
          </div>

          <button
            onClick={fetchOrders}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-100 p-2 rounded-2xl border border-slate-200">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              statusFilter === 'active' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            Active Orders ({orders.filter((o) => ['placed', 'preparing', 'ready'].includes(o.order_status)).length})
          </button>
          <button
            onClick={() => setStatusFilter('delivered')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              statusFilter === 'delivered' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            Delivered ({orders.filter((o) => o.order_status === 'delivered').length})
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              statusFilter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Today ({orders.length})
          </button>
        </div>

        {/* Meal Type Filter */}
        <div className="flex items-center gap-2">
          {['', 'breakfast', 'lunch', 'snacks', 'dinner'].map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMeal(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                selectedMeal === m ? 'bg-emerald-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m || 'All Meals'}
            </button>
          ))}
        </div>
      </div>

      {/* Token Cards Grid (High contrast, readable from a few feet away!) */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold text-lg">Loading live kitchen stream...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <ChefHat className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-xl font-bold text-slate-700">No active kitchen tokens right now</h3>
          <p className="text-xs text-slate-500 mt-1">New student orders will appear automatically on this grid.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredOrders.map((ord) => {
            const isDelivered = ord.order_status === 'delivered';
            const isReady = ord.order_status === 'ready';
            const isPreparing = ord.order_status === 'preparing' || ord.order_status === 'placed';

            // High contrast color coding
            let cardBg = 'bg-amber-50/90 border-amber-300 text-amber-950';
            let tokenBadgeBg = 'bg-amber-500 text-white';

            if (isReady) {
              cardBg = 'bg-blue-50 border-blue-400 text-blue-950';
              tokenBadgeBg = 'bg-blue-600 text-white';
            } else if (isDelivered) {
              cardBg = 'bg-emerald-50/70 border-emerald-300 text-emerald-950 opacity-75';
              tokenBadgeBg = 'bg-emerald-600 text-white';
            }

            return (
              <div
                key={ord._id}
                className={`rounded-3xl border-3 p-5 shadow-lg flex flex-col justify-between transition-all ${cardBg}`}
              >
                {/* Token Header */}
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-black/10">
                    <span className={`text-3xl font-black font-mono tracking-wider px-3.5 py-1 rounded-2xl shadow-sm ${tokenBadgeBg}`}>
                      {ord.token_number || 'B-000'}
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider bg-black/10 px-3 py-1 rounded-full">
                      {ord.meal_type}
                    </span>
                  </div>

                  {/* Student Info */}
                  <div className="mt-3 font-semibold text-xs opacity-90">
                    <p className="text-base font-bold text-slate-900 truncate">
                      {ord.student_id?.name || 'Student'}
                    </p>
                    <p className="text-[11px] font-mono text-slate-600">{ord.student_id?.roll_no || ''}</p>
                  </div>

                  {/* Food Items List */}
                  <div className="my-4 space-y-2 bg-white/70 p-3 rounded-2xl border border-black/5">
                    {ord.items?.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm font-extrabold text-slate-900">
                        <span>{it.item_name}</span>
                        <span className="bg-slate-900 text-white text-xs px-2.5 py-0.5 rounded-lg font-mono">
                          × {it.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Big Tap Target Action Button */}
                <div className="pt-2">
                  {isPreparing && (
                    <button
                      onClick={() => handleUpdateStatus(ord._id, 'ready')}
                      className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-2xl text-base shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Clock className="w-5 h-5" />
                      <span>MARK READY FOR PICKUP</span>
                    </button>
                  )}

                  {isReady && (
                    <button
                      onClick={() => handleUpdateStatus(ord._id, 'delivered')}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-base shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>MARK DELIVERED</span>
                    </button>
                  )}

                  {isDelivered && (
                    <div className="w-full py-3 bg-emerald-100 text-emerald-800 font-extrabold rounded-2xl text-center text-sm flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> Delivered & Completed
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

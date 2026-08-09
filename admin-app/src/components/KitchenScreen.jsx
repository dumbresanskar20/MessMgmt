import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Clock, ChefHat, Check, ShoppingBag, User, UtensilsCrossed, CreditCard, Banknote, QrCode, Receipt, Search, Printer } from 'lucide-react';
import api from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { createAdminSocketClient } from '../services/socket';
import SubscriptionWidget from './SubscriptionWidget';
import SubscriptionModal from './SubscriptionModal';

export default function KitchenScreen() {
  const { token, isSuperAdmin, subscription, fetchSubscriptionStatus, setSubscription, setSubscriptionExpired } = useAdminAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('all'); // 'all' | 'breakfast' | 'lunch' | 'snacks' | 'dinner'
  const [searchQuery, setSearchQuery] = useState('');
  const [todayIncome, setTodayIncome] = useState(null);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [printVerifyOrder, setPrintVerifyOrder] = useState(null);
  
  // Summary counts state
  const [orderCounts, setOrderCounts] = useState({
    breakfast: { total_orders_today: 0, active_tokens: 0 },
    lunch: { total_orders_today: 0, active_tokens: 0 },
    snacks: { total_orders_today: 0, active_tokens: 0 },
    dinner: { total_orders_today: 0, active_tokens: 0 },
    combined: { total_orders_today: 0, active_tokens: 0 },
    todays_menu_summary: [],
  });

  // Fetch today's orders & summary counts
  const fetchKitchenData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Fetch active kitchen orders
      let ordersUrl = `/orders/kitchen-orders?date=${todayStr}`;
      if (selectedMeal && selectedMeal !== 'all') {
        ordersUrl += `&meal_type=${selectedMeal}`;
      }
      
      const [ordersRes, countsRes] = await Promise.all([
        api.get(ordersUrl),
        api.get(`/orders/kitchen-order-counts?date=${todayStr}`),
      ]);

      if (ordersRes.data.success) {
        setOrders(ordersRes.data.orders || []);
      }

      if (countsRes.data.success && countsRes.data.orderCounts) {
        setOrderCounts(countsRes.data.orderCounts);
      }

      if (isSuperAdmin) {
        try {
          const incRes = await api.get('/orders/income/today');
          if (incRes.data.success) {
            setTodayIncome(incRes.data);
          }
        } catch (e) {
          console.warn('Income fetch error:', e);
        }
      }
    } catch (err) {
      console.error('Kitchen data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Socket.IO Real-time setup + 15s polling fallback
  useEffect(() => {
    fetchKitchenData();

    const socket = createAdminSocketClient(token);

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join:kitchen');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Real-time new order listener
    socket.on('order:new', (newOrder) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o._id === newOrder._id || o._id === newOrder.id);
        if (exists) return prev;
        return [...prev, newOrder].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });
      if (newOrder.orderCounts) {
        setOrderCounts(newOrder.orderCounts);
      }
    });

    // Consolidated Order Counts & Status Sync listener
    socket.on('order-counts-updated', (payload) => {
      if (payload.orderCounts) {
        setOrderCounts(payload.orderCounts);
      }

      if (payload.order_status === 'delivered') {
        // Remove delivered token row
        setOrders((prev) => prev.filter((o) => o._id !== payload.orderId && o._id !== payload.id));
      } else if (payload.orderId || payload.id) {
        // Update order status in place
        setOrders((prev) =>
          prev.map((o) =>
            o._id === payload.orderId || o._id === payload.id
              ? { ...o, order_status: payload.order_status }
              : o
          )
        );
      }
    });

    socket.on('order:status_updated', (payload) => {
      if (payload.order_status === 'delivered') {
        setOrders((prev) => prev.filter((o) => o._id !== payload.orderId && o._id !== payload.id));
      } else {
        setOrders((prev) =>
          prev.map((o) => (o._id === payload.orderId ? { ...o, order_status: payload.order_status } : o))
        );
      }
      if (payload.orderCounts) {
        setOrderCounts(payload.orderCounts);
      }
    });

    // 15-second Auto-Polling Fallback
    const interval = setInterval(() => {
      fetchKitchenData();
    }, 15000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [token, selectedMeal]);

  // Mark Delivered action with Optimistic UI
  const handleMarkDelivered = async (orderId) => {
    const previousOrders = [...orders];
    const previousCounts = { ...orderCounts };

    // Optimistically remove row from active list & decrement active counts
    setOrders((prev) => prev.filter((o) => o._id !== orderId));

    setOrderCounts((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      if (updated.combined && updated.combined.active_tokens > 0) {
        updated.combined.active_tokens -= 1;
      }
      return updated;
    });

    try {
      await api.patch(`/orders/status/${orderId}`, { order_status: 'delivered' });
    } catch (err) {
      console.error('Failed to mark order as delivered:', err);
      // Revert optimistic update on failure
      setOrders(previousOrders);
      setOrderCounts(previousCounts);
      alert('Failed to update status. Please check your network connection.');
    }
  };  // Listen to print window completion to show the manual confirmation modal
  useEffect(() => {
    const handlePrintMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'SHOW_PRINT_CONFIRMATION') {
        const orderId = event.data.orderId;
        if (orderId) {
          const targetOrder = orders.find((o) => o._id === orderId || o.id === orderId);
          if (targetOrder) {
            setPrintVerifyOrder(targetOrder);
          }
        }
      }
    };
    window.addEventListener('message', handlePrintMessage);
    return () => {
      window.removeEventListener('message', handlePrintMessage);
    };
  }, [orders]);
  const printReceipt = (order) => {
    const studentName = order.student_id?.name || order.student_name || 'Student';
    const mealType = order.meal_type.toUpperCase();
    const tokenNumber = order.token_number || 'T-00';
    const dateStr = new Date(order.created_at).toLocaleString();
    
    const itemsHtml = (order.items || []).map(it => `
      <tr style="border-bottom: 1px dashed #ddd;">
        <td style="padding: 6px 0; font-family: monospace;">${it.item_name || it.name}</td>
        <td style="padding: 6px 0; text-align: center; font-family: monospace;">${it.quantity}</td>
        <td style="padding: 6px 0; text-align: right; font-family: monospace;">₹${Number(it.price) * it.quantity}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (!printWindow) {
      alert('Pop-up blocker is preventing print view! Please allow popups for this site.');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - Token ${tokenNumber}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; width: 300px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .title { font-size: 18px; font-weight: bold; margin: 5px 0; }
            .token { font-size: 28px; font-weight: bold; margin: 10px 0; border: 2px solid #000; display: inline-block; padding: 5px 15px; }
            .details { font-size: 12px; margin-bottom: 10px; line-height: 1.4; }
            .table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; }
            .footer { text-align: center; border-top: 2px dashed #000; padding-top: 10px; margin-top: 15px; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">CAMPUS MESS</div>
            <div>RECEIPT / TOKEN</div>
            <div class="token">${tokenNumber}</div>
          </div>
          <div class="details">
            <strong>Date:</strong> ${dateStr}<br/>
            <strong>Student:</strong> ${studentName}<br/>
            <strong>Meal Window:</strong> ${mealType}<br/>
            <strong>Status:</strong> PAID
          </div>
          <table class="table">
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding: 4px 0;">Item</th>
                <th style="text-align: center; padding: 4px 0;">Qty</th>
                <th style="text-align: right; padding: 4px 0;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="border-top: 1px solid #000; font-weight: bold;">
                <td style="padding: 6px 0;" colspan="2">TOTAL</td>
                <td style="padding: 6px 0; text-align: right;">₹${Number(order.total_amount || 0)}</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            Thank you!<br/>
            Please present this token at the counter.
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
            window.onafterprint = function() {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: 'SHOW_PRINT_CONFIRMATION', orderId: '${order._id || order.id}' }, window.location.origin);
              }
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintAndDeliver = (order) => {
    printReceipt(order);
  };

  // Filter active tokens (exclude delivered / cancelled)
  const activeTokenList = orders.filter(
    (ord) => ord.order_status !== 'delivered' && ord.order_status !== 'cancelled'
  );

  const filteredTokenList = activeTokenList.filter((ord) => {
    const studentName = (ord.student_id?.name || ord.student_name || '').toLowerCase();
    const tokenNum = (ord.token_number || '').toLowerCase();
    const cleanQuery = searchQuery.toLowerCase().trim();
    return studentName.includes(cleanQuery) || tokenNum.includes(cleanQuery);
  });

  const MEAL_TYPES = [
    { id: 'all', label: 'All Meals' },
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'snacks', label: 'Snacks' },
    { id: 'dinner', label: 'Dinner' },
  ];

  if (!isSuperAdmin) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* Top Banner with Real-time Socket Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center text-xl">🍽️</span>
              <span>Kitchen Screen</span>
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Today's Meal Order Counts • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Status Indicators & Refresh */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchKitchenData}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              title="Manual Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold border ${
              connected
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-amber-50 border-amber-300 text-amber-800 animate-pulse'
            }`}>
              {connected ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-amber-600" />}
              <span>{connected ? 'Live Connected' : 'Reconnecting...'}</span>
            </div>
          </div>
        </div>

        {/* Larger Grid for Staff */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 px-1">
            Today's Order Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom duration-200">
            {['breakfast', 'lunch', 'snacks', 'dinner'].map((meal) => {
              const data = orderCounts[meal] || { total_orders_today: 0, active_tokens: 0 };
              const label = meal.charAt(0).toUpperCase() + meal.slice(1);
              const icons = { breakfast: '🍳', lunch: '🍱', snacks: '☕', dinner: '🍛' };
              const gradients = {
                breakfast: 'from-amber-50 to-orange-50/20 border-amber-200',
                lunch: 'from-blue-50 to-indigo-50/20 border-blue-200',
                snacks: 'from-orange-50 to-red-50/20 border-orange-200',
                dinner: 'from-purple-50 to-pink-50/20 border-purple-200',
              };

              return (
                <div key={meal} className={`bg-gradient-to-br ${gradients[meal]} p-6 rounded-3xl border shadow-sm flex flex-col justify-between h-48 space-y-4 hover:scale-[1.01] transition-all duration-200`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-lg font-black text-slate-800">{label}</span>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Fulfillment Counts</p>
                    </div>
                    <span className="text-2xl">{icons[meal]}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/50">
                    <div>
                      <span className="block text-2xl font-black text-slate-800">{data.total_orders_today}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
                    </div>
                    <div>
                      <span className="block text-2xl font-black text-amber-600">{data.active_tokens}</span>
                      <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Active Tokens</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* What's Cooking Today Summary for Staff */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-brand-orange" />
              <span>Today's Menu Ordered ("What's Cooking Today")</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-400 uppercase">
              {(orderCounts.todays_menu_summary || []).length} Unique Items
            </span>
          </div>

          {(!orderCounts.todays_menu_summary || orderCounts.todays_menu_summary.length === 0) ? (
            <div className="text-xs text-slate-400 font-medium py-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No menu items ordered yet today.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {orderCounts.todays_menu_summary.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-gradient-to-br from-amber-50/70 to-orange-50/40 rounded-2xl border border-amber-200/80 flex flex-col justify-between space-y-2"
                >
                  <span className="text-xs font-extrabold text-slate-900 line-clamp-1" title={item.item_name}>
                    {item.item_name}
                  </span>
                  <div className="flex items-baseline justify-between pt-1 border-t border-amber-200/50">
                    <span className="text-2xl font-black text-brand-orange leading-none">
                      {item.total_quantity}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      {item.total_quantity === 1 ? 'unit' : 'units'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-screen-2xl mx-auto">
      
      {/* Top Banner with Real-time Socket Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center text-xl">🔥</span>
            <span>Order Fulfillment Screen</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Live Active Token Queue & Daily Order Analytics • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Status Indicators & Refresh */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchKitchenData}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold border ${
            connected
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-amber-50 border-amber-300 text-amber-800 animate-pulse'
          }`}>
            {connected ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-amber-600" />}
            <span>{connected ? 'Live Socket Connected' : 'Reconnecting... (15s Fallback)'}</span>
          </div>
        </div>
      </div>

      {/* SUPER ADMIN ONLY: SYSTEM SUBSCRIPTION STATUS WIDGET */}
      {isSuperAdmin && (
        <SubscriptionWidget
          subscription={subscription}
          onOpenRenewModal={() => setRenewModalOpen(true)}
          onRefresh={fetchSubscriptionStatus}
        />
      )}

      {/* SUPER ADMIN ONLY: TODAY'S INCOME SUMMARY WIDGET */}
      {isSuperAdmin && todayIncome && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
              Super Admin Analytics • Today's Revenue
            </span>
            <span className="text-2xl font-black text-white">
              ₹{(todayIncome.total_income || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Razorpay (Online)</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.razorpay?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.razorpay?.count || 0} orders)</span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Counter Cash</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.counter_cash?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.counter_cash?.count || 0} orders)</span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Counter UPI</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.counter_upi?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.counter_upi?.count || 0} orders)</span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Other</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.other?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.other?.count || 0} orders)</span>
            </div>
          </div>
        </div>
      )}

      {/* 3A. SUMMARY COUNTS (TOP OF SCREEN) */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 px-1">
            Today's Order Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            
            {/* Combined Total Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Combined All Meals</span>
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">
                    {orderCounts.combined.total_orders_today}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-400 mt-1">Total Orders Today</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black text-amber-600 leading-none">
                    {orderCounts.combined.active_tokens}
                  </span>
                  <span className="block text-[10px] font-bold text-amber-600 uppercase mt-1">Active Tokens</span>
                </div>
              </div>
            </div>

            {/* Meal Specific Cards */}
            {['breakfast', 'lunch', 'snacks', 'dinner'].map((meal) => {
              const data = orderCounts[meal] || { total_orders_today: 0, active_tokens: 0 };
              const label = meal.charAt(0).toUpperCase() + meal.slice(1);
              return (
                <div key={meal} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                        {data.total_orders_today}
                      </span>
                      <span className="block text-[9px] font-semibold text-slate-400 mt-0.5">Total Orders</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl sm:text-2xl font-black text-amber-600 leading-none">
                        {data.active_tokens}
                      </span>
                      <span className="block text-[9px] font-bold text-amber-600 uppercase mt-0.5">Active</span>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* NEW SUMMARY CARD: TODAY'S MENU ORDERED ("WHAT'S COOKING TODAY") */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-brand-orange" />
              <span>Today's Menu Ordered ("What's Cooking Today")</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-400 uppercase">
              {(orderCounts.todays_menu_summary || []).length} Unique Items
            </span>
          </div>

          {(!orderCounts.todays_menu_summary || orderCounts.todays_menu_summary.length === 0) ? (
            <div className="text-xs text-slate-400 font-medium py-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No menu items ordered yet today.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {orderCounts.todays_menu_summary.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-gradient-to-br from-amber-50/70 to-orange-50/40 rounded-2xl border border-amber-200/80 flex flex-col justify-between space-y-2"
                >
                  <span className="text-xs font-extrabold text-slate-900 line-clamp-1" title={item.item_name}>
                    {item.item_name}
                  </span>
                  <div className="flex items-baseline justify-between pt-1 border-t border-amber-200/50">
                    <span className="text-2xl font-black text-brand-orange leading-none">
                      {item.total_quantity}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      {item.total_quantity === 1 ? 'unit' : 'units'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3B. ACTIVE TOKEN LIST SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Controls & Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Active Token Queue</h3>
            <span className="bg-amber-100 text-amber-800 font-extrabold text-xs px-2.5 py-0.5 rounded-full">
              {activeTokenList.length} Undelivered
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Live Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search token number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-slate-700 bg-slate-50"
              />
            </div>

            {/* Meal Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedMeal(type.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedMeal === type.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ACTIVE TOKEN LIST UI */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
            Loading active tokens...
          </div>
        ) : filteredTokenList.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto">
              {searchQuery.trim() ? '🔍' : '✨'}
            </div>
            <h4 className="text-slate-700 font-bold text-lg">
              {searchQuery.trim() ? 'No matching tokens found' : 'No active tokens in queue!'}
            </h4>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              {searchQuery.trim() 
                ? 'Try adjusting your search term or selecting another meal tab.'
                : `All placed orders for ${selectedMeal === 'all' ? 'today' : selectedMeal} have been delivered.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTokenList.map((ord) => {
              const studentName = ord.student_id?.name || ord.student_name || 'Student';
              const rollNo = ord.student_id?.roll_no || '';
              const isTokenOnly = ord.payment_status === 'token_only';

              return (
                <div
                  key={ord._id || ord.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  {/* Left: Token Number & Student Info */}
                  <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                    
                    {/* Prominent Token Number */}
                    <div className="w-20 sm:w-24 h-14 sm:h-16 rounded-2xl bg-amber-500 text-white font-black text-2xl sm:text-3xl flex items-center justify-center tracking-tight shadow-md shrink-0">
                      {ord.token_number || 'T-00'}
                    </div>

                    {/* Student & Order Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-base sm:text-lg text-slate-900 truncate">
                          {studentName}
                        </span>
                        {rollNo && (
                          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            {rollNo}
                          </span>
                        )}
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          {ord.meal_type}
                        </span>

                        {/* Payment Status Badge */}
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          isTokenOnly ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isTokenOnly ? 'Token Only' : 'Paid'}
                        </span>
                      </div>

                      {/* Items Summary Pills */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(ord.items || []).map((it, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200"
                          >
                            {it.quantity}x {it.item_name || it.name}
                          </span>
                        ))}
                      </div>

                      {/* Time Placed */}
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium pt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Placed at {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Action: Big Touch-Friendly PRINT RECEIPT Button */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handlePrintAndDeliver(ord)}
                      className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 min-w-[150px] justify-center cursor-pointer"
                    >
                      <Printer className="w-4 h-4 stroke-[3]" />
                      <span>PRINT RECEIPT</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* SUPER ADMIN RENEWAL MODAL */}
      <SubscriptionModal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        onSuccess={(updatedSub) => {
          setSubscription(updatedSub);
          setSubscriptionExpired(false);
          fetchSubscriptionStatus();
        }}
      />

      {/* PRINT VERIFICATION MODAL */}
      {printVerifyOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl animate-in zoom-in-95">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-4">
                🖨️
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Verify Print Success</h3>
              <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed">
                Did the receipt for Token <strong className="text-slate-800 font-bold">{printVerifyOrder.token_number || 'T-00'}</strong> print successfully?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={async () => {
                  const orderId = printVerifyOrder._id || printVerifyOrder.id;
                  setPrintVerifyOrder(null);
                  await handleMarkDelivered(orderId);
                }}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-2xl shadow-md transition-all cursor-pointer text-center"
              >
                Yes, Mark Delivered
              </button>
              <button
                onClick={() => setPrintVerifyOrder(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-black rounded-2xl transition-all cursor-pointer text-center"
              >
                No, Keep Placed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

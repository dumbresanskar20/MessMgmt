import React, { useState, useEffect } from 'react';
import { History, Filter, RefreshCw, Calendar, ChevronLeft, ChevronRight, CreditCard, Banknote, QrCode, Receipt, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function OrderHistoryScreen() {
  const { isSuperAdmin } = useAdminAuth();

  const [orders, setOrders] = useState([]);
  const [incomeSummary, setIncomeSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mealType, setMealType] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchOrderHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (mealType) params.append('meal_type', mealType);
      if (orderStatus) params.append('order_status', orderStatus);
      if (paymentStatus) params.append('payment_status', paymentStatus);
      params.append('page', page);
      params.append('limit', limit);

      const res = await api.get(`/orders/admin/orders/history?${params.toString()}`);
      if (res.data.success) {
        setOrders(res.data.orders || []);
        setTotalPages(res.data.total_pages || 1);
        setTotalCount(res.data.total_count || 0);
        if (res.data.income_summary) {
          setIncomeSummary(res.data.income_summary);
        } else {
          setIncomeSummary(null);
        }
      }
    } catch (err) {
      console.error('Error loading order history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderHistory();
  }, [page, from, to, mealType, orderStatus, paymentStatus]);

  const handleResetFilters = () => {
    setFrom('');
    setTo('');
    setMealType('');
    setOrderStatus('');
    setPaymentStatus('');
    setPage(1);
  };

  const formatPaymentMethod = (method) => {
    switch (method) {
      case 'razorpay':
        return { label: 'Razorpay (Online)', icon: CreditCard, color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'counter_cash':
        return { label: 'Counter Cash', icon: Banknote, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'counter_upi':
        return { label: 'Counter UPI', icon: QrCode, color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      default:
        return { label: method || 'N/A', icon: Receipt, color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-screen-2xl mx-auto">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg">📜</span>
            <span>Order History</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Complete log of mess orders within the 60-day retention window
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchOrderHistory}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <span className="bg-slate-100 text-slate-800 font-extrabold text-xs px-3.5 py-2 rounded-2xl border border-slate-200">
            {totalCount} Total Records
          </span>
        </div>
      </div>

      {/* Super Admin ONLY: Total Income Breakdown Summary Card */}
      {isSuperAdmin && incomeSummary && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-5 border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                Super Admin Financial Analytics
              </span>
              <h3 className="text-3xl font-black tracking-tight text-white mt-0.5">
                ₹{incomeSummary.total_income.toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Filtered Income Total ({incomeSummary.total_paid_orders} paid orders)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                Live Aggregation
              </span>
            </div>
          </div>

          {/* Breakdown Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Razorpay Online */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Razorpay (Online)</span>
                <span className="text-lg font-black text-white">₹{(incomeSummary.breakdown?.razorpay?.amount || 0).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-slate-400 block font-semibold">({incomeSummary.breakdown?.razorpay?.count || 0} orders)</span>
              </div>
            </div>

            {/* Counter Cash */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Counter Cash</span>
                <span className="text-lg font-black text-white">₹{(incomeSummary.breakdown?.counter_cash?.amount || 0).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-slate-400 block font-semibold">({incomeSummary.breakdown?.counter_cash?.count || 0} orders)</span>
              </div>
            </div>

            {/* Counter UPI */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Counter UPI</span>
                <span className="text-lg font-black text-white">₹{(incomeSummary.breakdown?.counter_upi?.amount || 0).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-slate-400 block font-semibold">({incomeSummary.breakdown?.counter_upi?.count || 0} orders)</span>
              </div>
            </div>

            {/* Other */}
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Other</span>
                <span className="text-lg font-black text-white">₹{(incomeSummary.breakdown?.other?.amount || 0).toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-slate-400 block font-semibold">({incomeSummary.breakdown?.other?.count || 0} orders)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Filter History Records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Date From */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          {/* Meal Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Meal Category</label>
            <select
              value={mealType}
              onChange={(e) => { setMealType(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none capitalize"
            >
              <option value="">All Categories</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="snacks">Snacks</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>

          {/* Order Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Order Status</label>
            <select
              value={orderStatus}
              onChange={(e) => { setOrderStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none capitalize"
            >
              <option value="">All Statuses</option>
              <option value="placed">Placed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none capitalize"
            >
              <option value="">All Payment Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {(from || to || mealType || orderStatus || paymentStatus) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
            Fetching order history records...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto">
              📂
            </div>
            <h4 className="text-slate-800 font-bold text-base">No order records match your criteria</h4>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              Try expanding date filters or selecting a different meal category.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Token #</th>
                  <th className="py-3.5 px-4">Student Info</th>
                  <th className="py-3.5 px-4">Meal Type</th>
                  <th className="py-3.5 px-4">Items Ordered</th>
                  <th className="py-3.5 px-4">Order Status</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  {isSuperAdmin && <th className="py-3.5 px-4 text-right">Total Amount</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {orders.map((ord) => {
                  const studentName = ord.student_id?.name || 'Student';
                  const rollNo = ord.student_id?.roll_no || '';
                  const pmInfo = formatPaymentMethod(ord.payment_method);
                  const PmIcon = pmInfo.icon;

                  return (
                    <tr key={ord._id || ord.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{ord.date}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Token # */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {ord.token_number ? (
                          <span className="font-black text-sm text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                            {ord.token_number}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold text-[11px]">No Token</span>
                        )}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{studentName}</div>
                        {rollNo && <div className="text-[10px] text-slate-500 font-semibold">{rollNo}</div>}
                      </td>

                      {/* Meal Type */}
                      <td className="py-3.5 px-4 uppercase text-[11px] font-black tracking-wider whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {ord.meal_type}
                        </span>
                      </td>

                      {/* Items Ordered */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(ord.items || []).map((it, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-800 text-[11px] font-semibold px-2 py-0.5 rounded">
                              {it.quantity}x {it.item_name}
                              {isSuperAdmin && it.price !== undefined && (
                                <span className="text-[10px] text-slate-500 ml-1">(₹{it.price * it.quantity})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Order Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-xl font-extrabold text-[10px] uppercase ${
                          ord.order_status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-900'
                            : ord.order_status === 'cancelled'
                            ? 'bg-red-100 text-red-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {ord.order_status}
                        </span>
                      </td>

                      {/* Payment Status & Method */}
                      <td className="py-3.5 px-4 whitespace-nowrap space-y-1">
                        <div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ord.payment_status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {ord.payment_status}
                          </span>
                        </div>
                        {isSuperAdmin && ord.payment_method && (
                          <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${pmInfo.color}`}>
                            <PmIcon className="w-3 h-3" />
                            <span>{pmInfo.label}</span>
                          </div>
                        )}
                      </td>

                      {/* Total Amount (Super Admin ONLY) */}
                      {isSuperAdmin && (
                        <td className="py-3.5 px-4 text-right font-black text-sm text-slate-900 whitespace-nowrap">
                          {ord.total_amount !== undefined ? `₹${ord.total_amount}` : 'N/A'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Page {page} of {totalPages} ({totalCount} total orders)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

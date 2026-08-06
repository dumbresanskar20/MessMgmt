import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  User, Mail, Phone, Calendar, ShoppingBag, CreditCard, 
  History, Key, Wallet, ShieldCheck, ShieldAlert, X
} from 'lucide-react';

export default function StudentDetails({ studentId, onClose }) {
  
  // 1. Fetch Student profile, orders, payments, tokens, audit logs, OTP history
  const { data, isLoading } = useQuery({
    queryKey: ['devStudentDetails', studentId],
    queryFn: async () => {
      // Get student basic details
      const studentRes = await axios.get(`/api/developer/crud/Student/${studentId}`);
      const student = studentRes.data.record;

      // Get orders for this student
      const ordersRes = await axios.get(`/api/developer/crud/Order?limit=20&filters=${JSON.stringify({ student_id: studentId })}`);
      const orders = ordersRes.data.records;

      // Get audit logs for this student
      const auditsRes = await axios.get(`/api/developer/crud/AuditLog?limit=15&search=${student.email}`);
      const audits = auditsRes.data.records;

      return {
        student,
        orders,
        audits,
      };
    },
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 bg-dark-900 text-dark-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-3"></div>
        <p className="text-xs">Loading Student Timeline Profile...</p>
      </div>
    );
  }

  const student = data?.student || {};
  const orders = data?.orders || [];
  const audits = data?.audits || [];

  return (
    <div className="flex h-full flex-col bg-[#0d0d11] text-dark-100 shadow-2xl">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-dark-850 p-4">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <User size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{student.name}</h3>
            <p className="text-[10px] text-dark-400">Roll: {student.roll_no}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded p-1.5 text-dark-400 hover:bg-dark-800 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Drawer Scroll Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Personal Details */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-dark-850 pb-1.5">Profile Info</h4>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-dark-500 block">Email Address</span>
              <span className="text-white break-all font-medium">{student.email}</span>
            </div>
            <div>
              <span className="text-[10px] text-dark-500 block">OTP Verified</span>
              <span className="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                {student.is_verified ? 'VERIFIED' : 'PENDING'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-dark-500 block">Account Status</span>
              <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                student.is_active 
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' 
                  : 'border-red-500/20 bg-red-500/5 text-red-400'
              }`}>
                {student.is_active ? 'ACTIVE' : 'LOCKED/DISABLED'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-dark-500 block">Registration Date</span>
              <span className="text-white font-medium">{new Date(student.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Orders History */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center space-x-1.5">
            <ShoppingBag size={14} className="text-indigo-400" />
            <span>Orders History ({orders.length})</span>
          </h4>

          <div className="space-y-2">
            {orders.length > 0 ? (
              orders.map((order) => (
                <div key={order.id} className="rounded-lg border border-dark-850 bg-dark-900/40 p-3 text-xs flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white">Order #{order.id}</p>
                    <p className="text-[10px] text-dark-400">{order.date} • {order.meal_type.toUpperCase()}</p>
                    <p className="text-[10px] text-dark-500">Token: <span className="font-semibold font-mono text-indigo-400">{order.token_number || '-'}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">₹{parseFloat(order.total_amount).toFixed(2)}</p>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium border ${
                      order.payment_status === 'paid' 
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' 
                        : 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                    }`}>
                      {order.payment_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-dark-500 p-2 text-center">No orders placed yet.</p>
            )}
          </div>
        </div>

        {/* Security & Access Logs */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center space-x-1.5">
            <History size={14} className="text-indigo-400" />
            <span>Recent Security Audit Trails</span>
          </h4>

          <div className="space-y-2">
            {audits.length > 0 ? (
              audits.map((log) => (
                <div key={log.id} className="rounded-lg border border-dark-850 bg-dark-900/40 p-2.5 text-[11px] space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white">{log.action}</span>
                    <span className="text-[9px] text-dark-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[10px] text-dark-400">IP: {log.ip_address || 'local'}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-dark-500 p-2 text-center">No security logs recorded.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

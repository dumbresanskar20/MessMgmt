import React from 'react';
import { LayoutGrid, UtensilsCrossed, Clock, Users, LogOut, ShieldCheck, ChefHat, Store, History } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { admin, isSuperAdmin, logout } = useAdminAuth();

  const navItems = [
    { id: 'kitchen', label: 'Kitchen Screen', icon: LayoutGrid, highlight: true },
    { id: 'counter', label: 'Counter Payments', icon: Store },
    { id: 'history', label: 'Order History', icon: History },
    { id: 'menu', label: 'Menu Management', icon: UtensilsCrossed },
    { id: 'timings', label: 'Meal Timings', icon: Clock },
  ];

  if (isSuperAdmin) {
    navItems.push({ id: 'staff', label: 'Manage Staff', icon: Users });
  }

  return (
    <aside className="w-64 bg-admin-sidebar text-slate-300 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none">
      <div>
        {/* Top Logo Header */}
        <div className="p-6 border-b border-slate-700/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
            👨‍🍳
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-tight leading-none">
              Canteen<span className="text-emerald-400">Admin</span>
            </h1>
            <span className="text-[11px] text-slate-400 font-medium">Mess Kitchen Operations</span>
          </div>
        </div>

        {/* User Info Badge */}
        <div className="mx-4 my-4 p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
            {admin?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{admin?.username || 'Admin User'}</p>
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">
              {admin?.role === 'super_admin' ? 'Super Admin' : 'Kitchen Staff'}
            </span>
          </div>
        </div>

        {/* Plain-Language Navigation Links (Text + Icon together) */}
        <nav className="px-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 text-left ${
                  active
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Footer */}
      <div className="p-4 border-t border-slate-700/60">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

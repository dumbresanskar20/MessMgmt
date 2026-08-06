import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Database, Users, ShieldAlert, Utensils, Clock, 
  ShoppingBag, ListOrdered, Binary, CreditCard, ScrollText, 
  Settings, LogOut, Menu, X, ChevronRight, Terminal, User
} from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Database Explorer', icon: Database, path: '/database' },
  ];

  const tableItems = [
    { name: 'Students', icon: Users, path: '/crud/Student' },
    { name: 'Admin Users', icon: ShieldAlert, path: '/crud/AdminUser' },
    { name: 'Menu Items', icon: Utensils, path: '/crud/MenuItem' },
    { name: 'Meal Windows', icon: Clock, path: '/crud/MealWindow' },
    { name: 'Orders', icon: ShoppingBag, path: '/crud/Order' },
    { name: 'Order Items', icon: ListOrdered, path: '/crud/OrderItem' },
    { name: 'Daily Token Counter', icon: Binary, path: '/crud/DailyTokenCounter' },
    { name: 'Subscriptions', icon: CreditCard, path: '/crud/Subscription' },
    { name: 'Audit Logs', icon: ScrollText, path: '/crud/AuditLog' },
  ];

  const footerItems = [
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  const renderNavLinks = (items) => {
    return items.map((item) => {
      const Icon = item.icon;
      const isActive = location.pathname === item.path;
      return (
        <Link
          key={item.name}
          to={item.path}
          onClick={() => setSidebarOpen(false)}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition duration-150 ${
            isActive
              ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
              : 'text-dark-300 hover:bg-dark-800 hover:text-white border border-transparent'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Icon size={18} className={isActive ? 'text-indigo-400' : 'text-dark-400'} />
            <span>{item.name}</span>
          </div>
          {isActive && <ChevronRight size={14} className="text-indigo-400" />}
        </Link>
      );
    });
  };

  return (
    <div className="flex min-h-screen bg-[#09090b] text-dark-100">
      
      {/* Sidebar - Mobile Toggle overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      {/* Sidebar Main */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-dark-800/80 bg-[#0d0d11]/90 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header/Logo */}
        <div className="flex h-14 items-center justify-between border-b border-dark-800/80 px-4">
          <Link to="/" className="flex items-center space-x-2 font-bold text-white">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Terminal size={14} />
            </div>
            <span className="tracking-tight">DevPanel</span>
            <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">v1.0</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="rounded p-1 text-dark-400 hover:bg-dark-800 hover:text-white md:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-dark-500 block mb-2">Core Panel</span>
            {renderNavLinks(navItems)}
          </div>

          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-dark-500 block mb-2">Prisma Models</span>
            {renderNavLinks(tableItems)}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-dark-800/80 p-3 space-y-1 bg-[#09090b]/40">
          {renderNavLinks(footerItems)}
          <button 
            onClick={handleLogout}
            className="flex w-full items-center space-x-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/20 transition duration-150 cursor-pointer"
          >
            <LogOut size={18} />
            <span>Developer Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Navbar */}
        <header className="flex h-14 items-center justify-between border-b border-dark-800/80 bg-[#0d0d11]/80 px-4 md:px-6">
          <div className="flex items-center">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="mr-3 rounded p-1 text-dark-400 hover:bg-dark-800 hover:text-white md:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-medium text-dark-300">
              Logged in as <span className="text-white font-semibold">{user?.name || 'Developer'}</span>
            </h1>
          </div>

          {/* Profile Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center space-x-2 rounded-full bg-dark-800/50 p-1.5 hover:bg-dark-800 text-dark-300 hover:text-white focus:outline-none transition cursor-pointer"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <User size={13} />
              </div>
            </button>

            {profileDropdownOpen && (
              <>
                <div onClick={() => setProfileDropdownOpen(false)} className="fixed inset-0 z-30" />
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-dark-850 bg-dark-900 p-1 shadow-lg z-40">
                  <div className="px-3 py-2 border-b border-dark-850">
                    <p className="text-xs text-dark-400">Developer Account</p>
                    <p className="text-xs font-semibold text-white truncate">{user?.email}</p>
                  </div>
                  <Link 
                    to="/settings" 
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex w-full items-center space-x-2 rounded px-3 py-2 text-xs text-dark-200 hover:bg-dark-800"
                  >
                    <Settings size={13} />
                    <span>My Profile Settings</span>
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="flex w-full items-center space-x-2 rounded px-3 py-2 text-xs text-red-400 hover:bg-red-950/20 text-left cursor-pointer"
                  >
                    <LogOut size={13} />
                    <span>Log Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-4 md:p-6 bg-[#09090b]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

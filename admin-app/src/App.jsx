import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import KitchenScreen from './components/KitchenScreen';

import OrderHistoryScreen from './components/OrderHistoryScreen';
import MenuManagement from './components/MenuManagement';
import MealTimings from './components/MealTimings';
import StaffManagement from './components/StaffManagement';
import AdminAuth from './components/AdminAuth';
import SubscriptionExpiredOverlay from './components/SubscriptionExpiredOverlay';
import SubscriptionModal from './components/SubscriptionModal';
import { useAdminAuth } from './context/AdminAuthContext';

import OwnerDashboard from './components/OwnerDashboard';

export default function App() {
  const {
    admin,
    logout,
    isAuthenticated,
    isSuperAdmin,
    subscriptionExpired,
    setSubscriptionExpired,
    subscription,
    setSubscription,
    fetchSubscriptionStatus,
  } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('kitchen');
  const [renewModalOpen, setRenewModalOpen] = useState(false);

  const isOwnerPath = typeof window !== 'undefined' && window.location.pathname === '/owner';

  // Path: /owner (Developer Panel)
  if (isOwnerPath) {
    if (!isAuthenticated) {
      return <AdminAuth />;
    }

    if (admin?.role !== 'owner') {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md bg-slate-900 border border-red-500/30 rounded-3xl p-8 shadow-2xl space-y-4">
            <div className="w-16 h-16 bg-red-950/50 text-red-500 border border-red-500/30 font-black text-3xl flex items-center justify-center mx-auto rounded-2xl">
              ⚠️
            </div>
            <h1 className="font-display font-extrabold text-xl text-red-400">Developer Panel - Access Denied</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              You are currently logged in as <span className="font-semibold text-white">{admin?.username || 'Staff'}</span> ({admin?.role}). 
              Canteen staff accounts are not authorized to view the developer database panel.
            </p>
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Go to Canteen Dashboard
              </button>
              <button
                onClick={logout}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Log Out of Current Session
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Authenticated as Owner on /owner path
    return <OwnerDashboard />;
  }

  // Path: / (Standard Canteen Admin Panel)
  if (!isAuthenticated) {
    return <AdminAuth />;
  }

  // Prevent Developer Owner account from accessing regular Canteen operational views directly
  if (admin?.role === 'owner') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-amber-950/50 text-amber-500 border border-amber-500/30 font-black text-3xl flex items-center justify-center mx-auto rounded-2xl">
            🛠️
          </div>
          <h1 className="font-display font-extrabold text-xl text-amber-400">Developer Account Detected</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            You are logged in with developer credentials. To manage canteen databases and system records, please visit the developer-only URL:
          </p>
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => {
                window.location.href = '/owner';
              }}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-950/30 transition-all cursor-pointer"
            >
              Access Database Management Panel
            </button>
            <button
              onClick={logout}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Once authenticated as staff/super_admin, render the Admin Panel dashboard
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-admin-bg text-admin-dark relative">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {activeTab === 'kitchen' && <KitchenScreen />}

        {activeTab === 'history' && <OrderHistoryScreen />}
        {activeTab === 'menu' && <MenuManagement />}
        {activeTab === 'timings' && <MealTimings />}
        {activeTab === 'staff' && isSuperAdmin && <StaffManagement />}
      </main>

      {/* Subscription Expired Blocking Overlay */}
      {subscriptionExpired && (
        <SubscriptionExpiredOverlay
          subscription={subscription}
          onOpenRenewModal={() => setRenewModalOpen(true)}
        />
      )}

      {/* Super Admin Renewal Modal */}
      <SubscriptionModal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        onSuccess={(updatedSub) => {
          setSubscription(updatedSub);
          setSubscriptionExpired(false);
          fetchSubscriptionStatus();
        }}
      />
    </div>
  );
}

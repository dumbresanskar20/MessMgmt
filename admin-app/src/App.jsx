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

export default function App() {
  const {
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

  // If staff/admin is not authenticated, render login or set-password screen
  if (!isAuthenticated) {
    return <AdminAuth />;
  }

  // Once authenticated, render the Admin Panel dashboard
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

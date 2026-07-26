import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import KitchenScreen from './components/KitchenScreen';
import MenuManagement from './components/MenuManagement';
import MealTimings from './components/MealTimings';
import StaffManagement from './components/StaffManagement';
import AdminAuth from './components/AdminAuth';
import { useAdminAuth } from './context/AdminAuthContext';

export default function App() {
  const { isAuthenticated, isSuperAdmin } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('kitchen');

  // If staff/admin is not authenticated, render login or set-password screen
  if (!isAuthenticated) {
    return <AdminAuth />;
  }

  // Once authenticated, render the Admin Panel dashboard
  return (
    <div className="min-h-screen flex bg-admin-bg text-admin-dark relative">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {activeTab === 'kitchen' && <KitchenScreen />}
        {activeTab === 'menu' && <MenuManagement />}
        {activeTab === 'timings' && <MealTimings />}
        {activeTab === 'staff' && isSuperAdmin && <StaffManagement />}
      </main>
    </div>
  );
}

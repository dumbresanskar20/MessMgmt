import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero3D from './components/Hero3D';
import MenuCard from './components/MenuCard';
import AuthModal from './components/AuthModal';
import CartDrawer from './components/CartDrawer';
import OrderSuccessModal from './components/OrderSuccessModal';
import OrderHistoryModal from './components/OrderHistoryModal';
import SubscriptionExpiredScreen from './components/SubscriptionExpiredScreen';
import { useCart } from './context/CartContext';
import { useAuth } from './context/AuthContext';
import { Utensils, Heart, Clock, AlertCircle, Info } from 'lucide-react';
import api from './services/api';
import { createSocketClient } from './services/socket';

export default function App() {
  const {
    selectedMealType,
    setSelectedMealType,
    activeMealWindows,
    currentMealWindow,
    allMealsInactive,
    redirectNotice,
  } = useCart();

  const { student, isAuthenticated, logout, openAuthModal } = useAuth();

  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [backendStatus, setBackendStatus] = useState({ is_active: true, is_currently_open: true });
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  
  // Modals state
  const [successToken, setSuccessToken] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);

  // Check subscription status on mount and listen for 402 event
  useEffect(() => {
    const checkSub = async () => {
      try {
        const res = await api.get('/subscription/status');
        if (res.data.subscription?.is_expired || res.data.subscription?.status !== 'active') {
          setSubscriptionExpired(true);
        }
      } catch (err) {
        if (err.response?.status === 402) {
          setSubscriptionExpired(true);
        }
      }
    };

    checkSub();

    const handleExpired = () => setSubscriptionExpired(true);
    window.addEventListener('subscription_expired', handleExpired);
    return () => window.removeEventListener('subscription_expired', handleExpired);
  }, []);

  // Real-time Socket.IO listener for live student order updates (when counter payment is marked paid)
  useEffect(() => {
    if (!isAuthenticated || !student) return;

    const studentId = student._id || student.id;
    const socket = createSocketClient();

    socket.on('connect', () => {
      if (studentId) {
        socket.emit('join:student', studentId);
      }
    });

    socket.on('student:order_updated', (payload) => {
      console.log('[Student Socket] Live order update received:', payload);
      if (payload.token_number && payload.payment_status === 'paid') {
        setSuccessToken(payload.token_number);
        setSuccessOrder(payload.order || { token_number: payload.token_number, payment_status: 'paid' });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, student]);

  // Check for reset_token in URL query parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tokenVal = params.get('reset_token') || params.get('token');
      if (tokenVal) {
        openAuthModal(false, 'reset-password', tokenVal);
      }
    }
  }, []);

  useEffect(() => {
    fetchMenuItems();
  }, [selectedMealType]);

  const fetchMenuItems = async () => {
    setLoadingMenu(true);
    try {
      const res = await api.get(`/menu/items?meal_type=${selectedMealType}&active_only=true`);
      if (res.data.success) {
        setBackendStatus({
          is_active: res.data.is_active !== false,
          is_currently_open: res.data.is_currently_open !== false,
        });
        setMenuItems(res.data.items || []);
      } else {
        setMenuItems(getFallbackMenu(selectedMealType));
      }
    } catch (err) {
      console.warn('API connection offline, utilizing fallback menu items.');
      setMenuItems(getFallbackMenu(selectedMealType));
    } finally {
      setLoadingMenu(false);
    }
  };

  const handleOrderSuccess = (tokenNumber, order) => {
    setSuccessToken(tokenNumber);
    setSuccessOrder(order);
  };

  const mealNameCapitalized = selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1);
  const isCurrentlyOpen = currentMealWindow ? currentMealWindow.is_currently_open : backendStatus.is_currently_open;
  const isFullDay = currentMealWindow ? currentMealWindow.is_full_day : false;
  const formattedStartTime = currentMealWindow?.formatted_start_time || '08:00 AM';
  const formattedEndTime = currentMealWindow?.formatted_end_time || '08:00 PM';

  if (subscriptionExpired) {
    return <SubscriptionExpiredScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-warmBg w-full max-w-full overflow-x-hidden">

      {/* Top Header with Persistent Top-Right Auth Control & Dynamic Navbar */}
      <Header onOpenOrders={() => setOrdersModalOpen(true)} />

      {/* Redirect Notice Toast Banner */}
      {redirectNotice && (
        <div className="bg-amber-500 text-white font-bold text-xs py-2.5 px-3 text-center flex items-center justify-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 w-full">
          <Info className="w-4 h-4 shrink-0" />
          <span className="truncate">{redirectNotice}</span>
        </div>
      )}

      {/* Hero Section */}
      <Hero3D />

      {/* Main Menu Section */}
      <main id="menu-section" className="flex-1 max-w-screen-2xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 overflow-hidden">
        
        {/* ALL MEAL TYPES INACTIVE EDGE CASE (CANTEEN CLOSED FOR HOLIDAY) */}
        {allMealsInactive ? (
          <div className="text-center py-16 sm:py-20 px-4 bg-white/80 backdrop-blur-md rounded-3xl border border-amber-200 shadow-sm max-w-2xl mx-auto my-6 space-y-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-100/80 text-brand-orange flex items-center justify-center text-4xl sm:text-5xl mx-auto shadow-inner animate-bounce">
              🍱
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-brand-dark tracking-tight">
              We're closed right now — check back soon!
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 font-medium max-w-md mx-auto">
              Canteen Management has temporarily paused all meal offerings today. Please check back during standard operating hours.
            </p>
          </div>
        ) : (
          <>
            {/* TIME-CLOSED BROWSING BANNER */}
            {!isCurrentlyOpen && (
              <div className="mb-6 sm:mb-8 p-3.5 sm:p-4 bg-amber-50 border border-amber-300 rounded-3xl shadow-sm text-amber-900 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-in fade-in">
                <div className="p-2 sm:p-2.5 bg-amber-100 text-amber-800 rounded-2xl shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-amber-950">
                    🕐 {mealNameCapitalized} ordering opens at {formattedStartTime} and closes at {formattedEndTime}.
                  </p>
                  <p className="text-amber-800 text-xs mt-0.5 font-medium">
                    You can browse today's menu items below, but ordering is currently closed until the next window opening.
                  </p>
                </div>
              </div>
            )}

            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 pb-3 sm:pb-4 border-b border-amber-200/60 gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-extrabold text-brand-orange uppercase tracking-wider bg-orange-100/80 px-2.5 sm:px-3 py-1 rounded-full mb-2">
                  <Utensils className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Campus Mess Kitchen</span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold font-display text-brand-dark tracking-tight">
                  Today's <span className="text-brand-orange capitalize">{selectedMealType}</span> Menu
                </h2>
                
                {/* Operating Window Badge */}
                {currentMealWindow && (
                  <div className="mt-1.5 inline-flex items-center gap-2 text-xs font-bold flex-wrap">
                    <Clock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span className="text-stone-600">
                      {isFullDay ? '24/7 Full-Day Ordering' : `Window: ${formattedStartTime} – ${formattedEndTime}`}
                    </span>

                    {isCurrentlyOpen ? (
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase">
                        Ordering Open
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase">
                        Ordering Closed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Menu Cards Grid */}
            {loadingMenu ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-80 bg-white/70 rounded-3xl border border-stone-200" />
                ))}
              </div>
            ) : !backendStatus.is_active ? (
              <div className="text-center py-12 sm:py-16 bg-amber-50/60 rounded-3xl border border-amber-200 space-y-2 px-4">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                <p className="font-display font-bold text-stone-800 text-base sm:text-lg">
                  {selectedMealType.toUpperCase()} is currently not offered by Canteen Management.
                </p>
                <p className="text-xs text-stone-500">Please select another active meal category above.</p>
              </div>
            ) : menuItems.length === 0 ? (
              <div className="text-center py-12 sm:py-16 bg-white/60 rounded-3xl border border-dashed border-amber-200 px-4">
                <p className="font-display font-bold text-stone-700 text-base sm:text-lg">No active items for this meal time right now.</p>
                <p className="text-xs text-stone-500 mt-1">Please select another meal category above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                {menuItems.map((item) => (
                  <MenuCard key={item._id || item.id} item={item} isCurrentlyOpen={isCurrentlyOpen} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-300 py-8 sm:py-10 border-t border-stone-800 w-full overflow-hidden">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-orange text-white flex items-center justify-center text-lg">🍱</div>
            <span className="font-display font-bold text-xl text-white">CampusMess</span>
          </div>
          <p className="text-xs text-stone-500">Fast, Fresh, & Digital Canteen Meal Token System</p>
          <div className="flex items-center justify-center gap-1 text-[11px] text-stone-600">
            <span>Crafted with</span>
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            <span>for hungry students</span>
          </div>
        </div>
      </footer>

      {/* Global Modals & Drawers */}
      <AuthModal />
      <CartDrawer onOrderSuccess={handleOrderSuccess} />
      <OrderSuccessModal
        tokenNumber={successToken}
        order={successOrder}
        onClose={() => {
          setSuccessToken(null);
          setSuccessOrder(null);
        }}
      />
      <OrderHistoryModal
        isOpen={ordersModalOpen}
        onClose={() => setOrdersModalOpen(false)}
      />
    </div>
  );
}

// Fallback seed data in case backend API isn't live during initial static preview
function getFallbackMenu(mealType) {
  const fallback = [
    {
      id: 'fb-1',
      _id: 'fb-1',
      name: 'Masala Dosa with Sambhar & Chutneys',
      meal_type: 'breakfast',
      price: 50,
      image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80',
      description: 'Crispy fermented rice-lentil crepe filled with spiced potato potato mash, served with coconut chutney.',
    },
    {
      id: 'fb-2',
      _id: 'fb-2',
      name: 'Fluffy Puri Bhaji (4 Pcs)',
      meal_type: 'breakfast',
      price: 45,
      image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
      description: 'Deep-fried golden whole wheat puris served with flavorful aromatic potato curry.',
    },
    {
      id: 'fb-3',
      _id: 'fb-3',
      name: 'Deluxe Veg Thali',
      meal_type: 'lunch',
      price: 90,
      image_url: 'https://images.unsplash.com/photo-1613292443284-8d10ef9383fe?auto=format&fit=crop&w=600&q=80',
      description: 'Paneer Butter Masala, Dal Tadka, Seasonal Veggie, 3 Butter Chapatis, Steamed Basmati Rice & Gulab Jamun.',
    },
    {
      id: 'fb-4',
      _id: 'fb-4',
      name: 'Hyderabadi Veg Dum Biryani',
      meal_type: 'lunch',
      price: 80,
      image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
      description: 'Fragrant long-grain basmati rice layered with slow-cooked marinated veggies and authentic saffron spices.',
    },
    {
      id: 'fb-5',
      _id: 'fb-5',
      name: 'Samosa Pav with Spicy Chutney (2 Pcs)',
      meal_type: 'snacks',
      price: 30,
      image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
      description: 'Crispy fried potato pastries stuffed inside soft bun rolls with garlic & tamarind chutneys.',
    },
    {
      id: 'fb-6',
      _id: 'fb-6',
      name: 'Special Paneer Butter Masala Meal',
      meal_type: 'dinner',
      price: 95,
      image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
      description: 'Rich tomato-cashew gravied soft paneer served with 2 Tandoori Butter Naan and salad.',
    },
  ];
  return fallback.filter((item) => item.meal_type === mealType);
}

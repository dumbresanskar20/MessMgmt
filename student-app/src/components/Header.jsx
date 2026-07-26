import React, { useState } from 'react';
import { ShoppingBag, User, LogOut, Receipt, ChevronDown, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Header({ onOpenOrders }) {
  const { student, isAuthenticated, openAuthModal, logout } = useAuth();
  const { cartCount, setIsCartOpen, isCartBouncing, selectedMealType, setSelectedMealType, activeMealWindows } = useCart();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const MEAL_CONFIG = {
    breakfast: { label: 'Breakfast', icon: '🌅' },
    lunch: { label: 'Lunch', icon: '☀️' },
    snacks: { label: 'Snacks', icon: '☕' },
    dinner: { label: 'Dinner', icon: '🌙' },
  };

  // Build dynamic navbar tabs strictly for meal types where is_active: true
  const dynamicTabs = (activeMealWindows && activeMealWindows.length > 0)
    ? activeMealWindows.map((w) => {
        const type = w.meal_type.toLowerCase();
        return {
          id: type,
          label: MEAL_CONFIG[type]?.label || type.charAt(0).toUpperCase() + type.slice(1),
          icon: MEAL_CONFIG[type]?.icon || '🍱',
          isCurrentlyOpen: w.is_currently_open,
          isFullDay: w.is_full_day,
        };
      })
    : [
        { id: 'breakfast', label: 'Breakfast', icon: '🌅', isCurrentlyOpen: true, isFullDay: false },
        { id: 'lunch', label: 'Lunch', icon: '☀️', isCurrentlyOpen: true, isFullDay: false },
        { id: 'snacks', label: 'Snacks', icon: '☕', isCurrentlyOpen: true, isFullDay: false },
        { id: 'dinner', label: 'Dinner', icon: '🌙', isCurrentlyOpen: true, isFullDay: false },
      ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-amber-100/80 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white text-2xl shadow-warm hover:rotate-6 transition-transform">
              🍱
            </div>
            <div>
              <span className="font-display font-extrabold text-xl sm:text-2xl text-brand-dark tracking-tight leading-none block">
                Campus<span className="text-brand-orange">Mess</span>
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-stone-500 tracking-wider uppercase hidden sm:block">
                Fresh & Delicious Daily
              </span>
            </div>
          </div>

          {/* Dynamic Desktop Category Meal Nav */}
          {dynamicTabs.length > 0 && (
            <nav className="hidden md:flex items-center gap-1.5 bg-stone-100/80 p-1.5 rounded-2xl border border-stone-200/60">
              {dynamicTabs.map((tab) => {
                const active = selectedMealType === tab.id;
                const isClosed = !tab.isCurrentlyOpen;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedMealType(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                      active
                        ? isClosed
                          ? 'bg-amber-900/90 text-amber-100 shadow-md scale-105 border border-amber-700/50'
                          : 'bg-gradient-to-r from-brand-orange to-amber-600 text-white shadow-md scale-105'
                        : isClosed
                        ? 'text-stone-400 bg-stone-100/60 hover:text-stone-700 hover:bg-stone-200/50 border border-stone-200/40'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>

                    {/* Time-Closed Badge Treatment */}
                    {isClosed && (
                      <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase ${
                        active ? 'bg-amber-950/60 text-amber-200' : 'bg-stone-200/80 text-stone-500'
                      }`}>
                        <Clock className="w-2.5 h-2.5" />
                        <span>Closed</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right Action Bar: Cart Icon & Persistent Auth Control */}
          <div className="flex items-center gap-3">
            
            {/* Cart Tray Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative inline-flex items-center justify-center p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-brand-terracotta hover:bg-amber-100/80 transition-all shadow-sm ${
                isCartBouncing ? 'animate-pulse-cart scale-110 border-brand-orange' : ''
              }`}
              aria-label="View Cart"
            >
              <ShoppingBag className="w-5 h-5 text-brand-orange" />
              <span className="hidden sm:inline font-bold text-sm ml-2 text-stone-800">Tray</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white font-extrabold text-[11px] w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Persistent Auth Control (FIXED TOP-RIGHT AT ALL TIMES) */}
            {isAuthenticated && student ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300 text-brand-dark px-3.5 py-2 rounded-2xl font-semibold text-xs sm:text-sm hover:shadow-sm transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-orange text-white font-bold flex items-center justify-center text-xs">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline font-bold max-w-[100px] truncate">{student.name}</span>
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-stone-100">
                      <p className="text-xs text-stone-500 font-medium">Logged in as</p>
                      <p className="text-sm font-bold text-stone-800 truncate">{student.name}</p>
                      <p className="text-[11px] text-stone-400 truncate">{student.roll_no}</p>
                    </div>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenOrders();
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-stone-700 font-semibold hover:bg-amber-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Receipt className="w-4 h-4 text-brand-orange" />
                      <span>My Order History</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-red-600 font-semibold hover:bg-red-50 flex items-center gap-2.5 transition-colors border-t border-stone-100"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openAuthModal(false)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-2xl shadow-warm hover:shadow-cardHover transition-all transform active:scale-95"
              >
                <User className="w-4 h-4" />
                <span>Sign In / Sign Up</span>
              </button>
            )}

          </div>

        </div>

        {/* Dynamic Mobile Navigation Meal Type Tabs */}
        {dynamicTabs.length > 0 && (
          <div className="flex md:hidden items-center justify-around py-2.5 border-t border-amber-100/60 overflow-x-auto gap-2">
            {dynamicTabs.map((tab) => {
              const active = selectedMealType === tab.id;
              const isClosed = !tab.isCurrentlyOpen;

              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMealType(tab.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    active
                      ? isClosed
                        ? 'bg-amber-900 text-amber-100 shadow-sm'
                        : 'bg-brand-orange text-white shadow-sm'
                      : isClosed
                      ? 'bg-stone-100 text-stone-400 opacity-70'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {isClosed && (
                    <span className="text-[9px] font-extrabold uppercase">(Closed)</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

      </div>
    </header>
  );
}

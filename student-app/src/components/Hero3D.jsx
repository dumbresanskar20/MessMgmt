import React from 'react';
import { Sparkles, Utensils } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function Hero3D() {
  const { selectedMealType, setSelectedMealType, activeMealWindows } = useCart();

  const MEAL_CONFIG = {
    breakfast: { label: 'Breakfast', icon: '🌅' },
    lunch: { label: 'Lunch', icon: '☀️' },
    snacks: { label: 'Snacks', icon: '☕' },
    dinner: { label: 'Dinner', icon: '🌙' },
  };

  // Build list of active meal type buttons dynamically
  const availableMealTypes = (activeMealWindows && activeMealWindows.length > 0)
    ? activeMealWindows.map((w) => {
        const type = w.meal_type.toLowerCase();
        return {
          id: type,
          label: MEAL_CONFIG[type]?.label || type.charAt(0).toUpperCase() + type.slice(1),
          icon: MEAL_CONFIG[type]?.icon || '🍱',
          isCurrentlyOpen: w.is_currently_open,
          startTime: w.formatted_start_time,
          endTime: w.formatted_end_time,
        };
      })
    : [
        { id: 'breakfast', label: 'Breakfast', icon: '🌅', isCurrentlyOpen: true },
        { id: 'lunch', label: 'Lunch', icon: '☀️', isCurrentlyOpen: true },
        { id: 'snacks', label: 'Snacks', icon: '☕', isCurrentlyOpen: true },
        { id: 'dinner', label: 'Dinner', icon: '🌙', isCurrentlyOpen: true },
      ];

  const handleMealSelect = (typeId) => {
    setSelectedMealType(typeId);
    const menuEl = document.getElementById('menu-section');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-amber-100/70 via-orange-50/50 to-brand-warmBg py-8 sm:py-12 md:py-16 w-full">
      {/* Background Subtle Ambient Orbs */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[300px] rounded-full bg-gradient-to-tr from-amber-300/30 to-orange-400/20 blur-3xl pointer-events-none" />

      <div className="max-w-screen-xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10 text-center w-full">
        <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
          
          {/* Top Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-amber-100/90 border border-amber-300 text-brand-terracotta text-[11px] sm:text-xs md:text-sm font-semibold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-sm max-w-full">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-orange animate-spin shrink-0" style={{ animationDuration: '6s' }} />
            <span className="truncate">Piping Hot & Fresh Daily • Campus Canteen</span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-extrabold font-display tracking-tight text-brand-dark leading-[1.15]">
            Delicious Meals, <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange via-amber-600 to-brand-terracotta">
              Zero Waiting Time.
            </span>
          </h1>

          {/* Subtext */}
          <p className="text-xs sm:text-base lg:text-lg text-stone-600 max-w-xl mx-auto leading-relaxed font-medium px-2">
            Browse breakfast & lunch, pick your tray, and get instant digital meal tokens right on your phone. Fresh, hygienic, and prepared with love.
          </p>

          {/* Dynamic Meal Type Selection Buttons */}
          <div className="pt-2 w-full">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-stone-500 mb-2.5 flex items-center justify-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span>Select Meal Category To View Menu</span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-2xl mx-auto px-1">
              {availableMealTypes.map((meal) => {
                const isSelected = selectedMealType === meal.id;
                const isOpen = meal.isCurrentlyOpen;

                return (
                  <button
                    key={meal.id}
                    onClick={() => handleMealSelect(meal.id)}
                    className={`min-h-[44px] sm:min-h-[48px] px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm transition-all duration-200 flex items-center gap-2 shadow-sm border cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-brand-dark text-white border-brand-dark shadow-md ring-2 ring-brand-orange/40 scale-[1.03]'
                        : isOpen
                        ? 'bg-white text-stone-700 border-amber-200/90 hover:border-amber-400 hover:bg-amber-50/50'
                        : 'bg-stone-100/90 text-stone-500 border-stone-200 hover:bg-stone-200/60'
                    }`}
                  >
                    {/* Status Light Indicator */}
                    <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0">
                      {isOpen ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500" />
                        </>
                      ) : (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-rose-500" />
                        </>
                      )}
                    </span>

                    <span className="text-sm sm:text-base">{meal.icon}</span>
                    <span>{meal.label}</span>

                    {!isOpen && (
                      <span className="text-[9px] sm:text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                        Closed
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Micro Feature Badges */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3 max-w-md sm:max-w-lg mx-auto text-center px-1">
            <div className="bg-white/70 backdrop-blur-sm p-2 sm:p-3.5 rounded-2xl border border-amber-100/90 shadow-xs">
              <span className="block font-extrabold font-display text-sm sm:text-lg text-brand-orange">B-001</span>
              <span className="text-[9px] sm:text-[11px] text-stone-500 font-semibold uppercase tracking-wider block truncate">Live Tokens</span>
            </div>
            <div className="bg-white/70 backdrop-blur-sm p-2 sm:p-3.5 rounded-2xl border border-amber-100/90 shadow-xs">
              <span className="block font-extrabold font-display text-sm sm:text-lg text-emerald-700">⚡ 3 Mins</span>
              <span className="text-[9px] sm:text-[11px] text-stone-500 font-semibold uppercase tracking-wider block truncate">Avg Prep</span>
            </div>
            <div className="bg-white/70 backdrop-blur-sm p-2 sm:p-3.5 rounded-2xl border border-amber-100/90 shadow-xs">
              <span className="block font-extrabold font-display text-sm sm:text-lg text-amber-600">100% Veg</span>
              <span className="text-[9px] sm:text-[11px] text-stone-500 font-semibold uppercase tracking-wider block truncate">Hygienic</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

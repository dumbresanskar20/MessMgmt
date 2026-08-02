import React from 'react';
import { ShieldAlert, AlertCircle, UtensilsCrossed } from 'lucide-react';

export default function SubscriptionExpiredScreen() {
  return (
    <div className="fixed inset-0 z-[9999] bg-stone-950/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 text-stone-100 overflow-hidden">
      <div className="max-w-lg w-full bg-stone-900 border border-amber-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
        
        {/* Animated Canteen Icon */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
          <UtensilsCrossed className="w-10 h-10 sm:w-12 sm:h-12 animate-bounce" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-extrabold uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Service Temporarily Unavailable</span>
        </div>

        {/* Main Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
            This canteen's subscription has expired.
          </h1>

          <p className="text-xs sm:text-sm text-stone-400 max-w-md mx-auto leading-relaxed">
            Online meal token ordering, menu browsing, and counter operations are currently paused. Please check back soon or contact canteen administration.
          </p>
        </div>

        {/* Informational Card (NO PAYMENT OPTION EVER) */}
        <div className="bg-stone-800/80 border border-stone-700/80 rounded-2xl p-4 text-xs text-stone-400 flex items-start gap-3 text-left">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            If you have an active order or token number placed earlier, please present your order confirmation at the counter.
          </span>
        </div>

        <div className="pt-2 text-[11px] text-stone-500">
          CampusMess • Digital Canteen Management System
        </div>
      </div>
    </div>
  );
}

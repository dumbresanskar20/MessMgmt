import React from 'react';
import { ShieldAlert, Zap, Lock, LogOut } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function SubscriptionExpiredOverlay({ onOpenRenewModal, subscription }) {
  const { isSuperAdmin, logout } = useAdminAuth();

  const formattedEndDate = subscription?.subscription_end_date
    ? new Date(subscription.subscription_end_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Recently';

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 text-white overflow-hidden">
      <div className="max-w-lg w-full bg-slate-900/90 border border-red-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300 relative">
        
        {/* Lock / Alert Icon */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse" />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded-full text-xs font-extrabold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            <span>Application Suspended</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            This canteen's subscription has expired.
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            All system services (ordering, menu, kitchen screen, and reports) have been locked because the application recurring subscription ended on <span className="text-slate-200 font-bold">{formattedEndDate}</span>.
          </p>
        </div>

        {/* Role Specific Action */}
        {isSuperAdmin ? (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
            <p className="text-xs text-amber-400 font-semibold">
              👑 You are logged in as <span className="font-extrabold underline">Super Admin</span>. You can renew the subscription below to instantly reactivate access for the whole canteen.
            </p>

            <button
              onClick={onOpenRenewModal}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Zap className="w-5 h-5 fill-white" />
              <span>Renew Subscription Now</span>
            </button>
          </div>
        ) : (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-2 text-left">
            <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-red-400 shrink-0" />
              <span>Staff Account Notice</span>
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Please inform your Canteen Super Admin to pay the developer subscription fee to restore kitchen operations.
            </p>
          </div>
        )}

        {/* Secondary Logout option */}
        <div className="pt-2">
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out Admin Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}

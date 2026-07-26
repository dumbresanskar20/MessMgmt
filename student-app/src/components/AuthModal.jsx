import React, { useState } from 'react';
import { X, Mail, Lock, User, Contact, ArrowRight, KeyRound, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const { authModalOpen, closeAuthModal, pendingCheckout, login, signup, verifyOtp, loading } = useAuth();
  
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'otp'
  const [otpEmail, setOtpEmail] = useState('');

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupRollNo, setSignupRollNo] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const [otpCode, setOtpCode] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!authModalOpen) return null;

  const resetFormAlerts = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    const res = await login(loginEmail, loginPassword);
    if (!res.success) {
      if (res.requires_otp) {
        setOtpEmail(res.email);
        setMode('otp');
        setSuccessMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    } else {
      setSuccessMsg(res.message);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    const res = await signup({
      name: signupName,
      email: signupEmail,
      roll_no: signupRollNo,
      password: signupPassword,
    });

    if (res.success) {
      setOtpEmail(res.email);
      setMode('otp');
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    const res = await verifyOtp(otpEmail, otpCode);
    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-100 p-6 sm:p-8">
        
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Top Branding & Context Notice */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-brand-orange flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
            🍱
          </div>

          <h2 className="text-2xl font-extrabold font-display text-brand-dark">
            {mode === 'login' && 'Welcome Back!'}
            {mode === 'signup' && 'Create Student Account'}
            {mode === 'otp' && 'Verify Your Email'}
          </h2>

          <p className="text-xs text-stone-500 mt-1 font-medium">
            {pendingCheckout ? (
              <span className="text-brand-orange font-bold flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Please sign in to finalize your meal order
              </span>
            ) : (
              'Sign in to order hot meals with digital token numbers'
            )}
          </p>
        </div>

        {/* Alert Messages */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Mode Switch Tabs */}
        {mode !== 'otp' && (
          <div className="flex bg-stone-100 p-1 rounded-2xl mb-6">
            <button
              onClick={() => { setMode('login'); resetFormAlerts(); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'login' ? 'bg-white text-brand-dark shadow-sm' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); resetFormAlerts(); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'signup' ? 'bg-white text-brand-dark shadow-sm' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Form: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Student Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  required
                  placeholder="student@college.edu"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all outline-none font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold rounded-2xl text-sm shadow-warm transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Signing In...' : 'Sign In to Campus Mess'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Form: SIGNUP */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-0.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  required
                  placeholder="Sanskar Dumbre"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-0.5">Roll Number</label>
              <div className="relative">
                <Contact className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  required
                  placeholder="2026-CS-042"
                  value={signupRollNo}
                  onChange={(e) => setSignupRollNo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-0.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  required
                  placeholder="student@college.edu"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-0.5">Create Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold rounded-2xl text-xs shadow-warm transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Creating Account...' : 'Continue to OTP Verification'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Form: OTP VERIFICATION */}
        {mode === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4 text-center">
            <p className="text-xs text-stone-600">
              Enter the 6-digit verification code sent to <br />
              <strong className="text-brand-dark font-bold">{otpEmail}</strong>
            </p>

            <div className="relative my-4">
              <KeyRound className="absolute left-4 top-3.5 w-5 h-5 text-brand-orange" />
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-amber-50/80 border border-amber-300 rounded-2xl text-center font-display font-extrabold text-2xl tracking-[0.4em] text-brand-terracotta focus:ring-2 focus:ring-brand-orange outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Verifying OTP...' : 'Verify OTP & Finish'}
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

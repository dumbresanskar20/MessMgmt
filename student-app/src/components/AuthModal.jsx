import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Contact, ArrowRight, KeyRound, AlertCircle, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const {
    authModalOpen,
    authModalMode,
    resetToken: contextResetToken,
    closeAuthModal,
    pendingCheckout,
    login,
    signup,
    verifyOtp,
    resendOtp,
    forgotPassword,
    resetPassword,
    loading,
  } = useAuth();
  
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'otp' | 'forgot-password' | 'reset-password'
  const [otpEmail, setOtpEmail] = useState('');

  // Password visibility toggle states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] = useState(false);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupRollNo, setSignupRollNo] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const [otpCode, setOtpCode] = useState('');
  
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync mode from context when modal opens or mode changes
  useEffect(() => {
    if (authModalMode) {
      setMode(authModalMode);
    }
  }, [authModalMode, authModalOpen]);

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
        setOtpEmail(res.email || loginEmail.trim().toLowerCase());
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
      setOtpEmail(res.email || signupEmail.trim().toLowerCase());
      setMode('otp');
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.errors && res.errors.length ? res.errors.join('. ') : res.message);
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

  const handleResendOtp = async () => {
    resetFormAlerts();
    if (!otpEmail) {
      setErrorMsg('Email address is missing.');
      return;
    }
    const res = await resendOtp(otpEmail);
    if (res.success) {
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    const res = await forgotPassword(forgotEmail);
    if (res.success) {
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    resetFormAlerts();

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    if (!contextResetToken) {
      setErrorMsg('Missing or invalid reset token.');
      return;
    }

    const res = await resetPassword(contextResetToken, newPassword);
    if (res.success) {
      setSuccessMsg(res.message);
      setTimeout(() => {
        setMode('login');
        setLoginPassword('');
      }, 2000);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-md animate-in fade-in overflow-hidden">
      <div className="relative w-full max-w-md my-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-100 p-4 sm:p-7 max-h-[92vh] flex flex-col justify-between overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Top Branding & Context Notice */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-100 text-brand-orange flex items-center justify-center text-xl sm:text-2xl mx-auto mb-2 sm:mb-3 shadow-inner">
            🍱
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold font-display text-brand-dark">
            {mode === 'login' && 'Welcome Back!'}
            {mode === 'signup' && 'Create Student Account'}
            {mode === 'otp' && 'Verify Your Email'}
            {mode === 'forgot-password' && 'Reset Your Password'}
            {mode === 'reset-password' && 'Set New Password'}
          </h2>

          <p className="text-xs text-stone-500 mt-1 font-medium px-2">
            {pendingCheckout ? (
              <span className="text-brand-orange font-bold flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Please sign in to finalize your meal order
              </span>
            ) : mode === 'forgot-password' ? (
              'Enter your registered email to receive a password reset link'
            ) : mode === 'reset-password' ? (
              'Enter and confirm your new password below'
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
        {(mode === 'login' || mode === 'signup') && (
          <div className="flex bg-stone-100 p-1 rounded-2xl mb-4 sm:mb-6">
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
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-stone-700">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot-password'); resetFormAlerts(); setForgotEmail(loginEmail); }}
                  className="text-xs font-bold text-brand-orange hover:underline focus:outline-none"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white transition-all outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
          <form onSubmit={handleSignupSubmit} className="space-y-2.5">
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
                  type={showSignupPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute right-3 top-2 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
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

        {/* Form: FORGOT PASSWORD */}
        {mode === 'forgot-password' && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Registered Student Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  required
                  placeholder="student@college.edu"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-orange to-amber-600 hover:from-amber-600 hover:to-brand-orange text-white font-bold rounded-2xl text-sm shadow-warm transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Sending Link...' : 'Send Password Reset Link'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => { setMode('login'); resetFormAlerts(); }}
              className="w-full text-center text-xs font-bold text-stone-500 hover:text-brand-dark py-1 transition-colors"
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* Form: RESET PASSWORD (FROM EMAIL TOKEN) */}
        {mode === 'reset-password' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                <input
                  type={showConfirmResetPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-orange focus:bg-white outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmResetPassword(!showConfirmResetPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label={showConfirmResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Updating Password...' : 'Set New Password'}
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Form: OTP VERIFICATION */}
        {mode === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-3.5 text-center">
            <p className="text-xs text-stone-600">
              Enter the 6-digit verification code sent to <br />
              <strong className="text-brand-dark font-bold truncate block">{otpEmail}</strong>
            </p>

            <div className="relative my-3">
              <KeyRound className="absolute left-3.5 top-3.5 w-5 h-5 text-brand-orange" />
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-amber-50/80 border border-amber-300 rounded-2xl text-center font-display font-extrabold text-xl sm:text-2xl tracking-[0.3em] text-brand-terracotta focus:ring-2 focus:ring-brand-orange outline-none"
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

            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="font-bold text-brand-orange hover:underline focus:outline-none disabled:opacity-50"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); resetFormAlerts(); }}
                className="font-bold text-stone-500 hover:text-stone-800 transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

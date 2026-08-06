import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Terminal, Shield, Lock, Mail, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const result = await login(data.email, data.password);
      if (result.success) {
        toast.success('Successfully logged in as Developer');
      } else {
        setErrorMsg(result.message);
        toast.error(result.message);
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#09090b] px-4 py-12">
      {/* Background visual elements */}
      <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[120px]"></div>
      
      <div className="w-full max-w-md">
        {/* Logo and header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mb-3 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]">
            <Terminal size={24} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Developer Panel</h2>
          <p className="mt-2 text-sm text-dark-400">Database and admin operations management portal</p>
        </div>

        {/* Card Panel */}
        <div className="glass-panel rounded-2xl p-8 shadow-2xl border border-dark-800 bg-dark-900/60">
          <div className="flex items-center space-x-2 border-b border-dark-800 pb-4 mb-6">
            <Shield size={16} className="text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-dark-300">Authentication Required</span>
          </div>

          {errorMsg && (
            <div className="mb-6 flex items-start space-x-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3.5 text-sm text-red-400">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-200 mb-1.5">
                Developer Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-dark-500">
                  <Mail size={16} />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="developer@mess.com"
                  className={`block w-full rounded-lg border bg-dark-950/50 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-dark-600 outline-none transition duration-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${
                    errors.email ? 'border-red-500/40 focus:border-red-500' : 'border-dark-800'
                  }`}
                  {...register('email', {
                    required: 'Email address is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-dark-200">
                  Security Password
                </label>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-dark-500">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className={`block w-full rounded-lg border bg-dark-950/50 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-dark-600 outline-none transition duration-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${
                    errors.password ? 'border-red-500/40 focus:border-red-500' : 'border-dark-800'
                  }`}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="relative flex w-full items-center justify-center rounded-lg bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white shadow-lg transition duration-200 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-dark-950 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                'Secure Login'
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-dark-500">
          Super Developer Account Access Protection active. All connections are audited.
        </div>
      </div>
    </div>
  );
}

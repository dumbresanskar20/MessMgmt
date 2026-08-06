import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { 
  User, Lock, Database, RefreshCcw, Save, ShieldAlert, 
  Terminal, Sparkles, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const {
    register: registerPass,
    handleSubmit: handlePassSubmit,
    reset: resetPass,
    formState: { errors: passErrors }
  } = useForm();

  const onChangePassword = async (data) => {
    setLoading(true);
    try {
      // Direct update of the Developer model via generic CRUD endpoint!
      // This is a beautiful reuse of the CRUD architecture!
      await axios.put(`/api/developer/crud/Developer/${user.id}`, {
        password_hash: data.newPassword,
      });
      toast.success('Developer password updated successfully.');
      resetPass();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerRestore = () => {
    setRestoreLoading(true);
    toast.promise(
      new Promise((resolve) => {
        setTimeout(() => {
          setRestoreLoading(false);
          resolve();
        }, 2000);
      }),
      {
        loading: 'Uploading dump and rebuilding tables indexes...',
        success: 'Database restore simulated successfully (Safe dry-run)',
        error: 'Failed to restore database',
      }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
          <Terminal size={20} className="text-indigo-400" />
          <span>System Settings & Developer Profile</span>
        </h2>
        <p className="text-sm text-dark-400">Manage security settings, access credentials, and execute database maintenance.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Developer Profile Card */}
        <div className="glass-panel rounded-xl p-5 border border-dark-800 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <User size={16} className="text-indigo-400" />
            <span>Developer Profile Info</span>
          </h3>

          <div className="space-y-3.5 text-xs">
            <div className="rounded-lg bg-dark-950/60 p-3.5 border border-dark-850">
              <span className="text-[10px] text-dark-500 block font-semibold uppercase tracking-wider">Account Role</span>
              <span className="text-indigo-400 font-bold font-mono tracking-wide mt-1 block">PLATFORM_SUPER_DEVELOPER</span>
            </div>
            
            <div>
              <label className="block text-dark-400 mb-1">Full Display Name</label>
              <input
                type="text"
                value={user?.name || ''}
                disabled
                className="w-full rounded-lg border border-dark-800 bg-dark-950/40 p-2.5 text-dark-400 cursor-not-allowed outline-none"
              />
            </div>

            <div>
              <label className="block text-dark-400 mb-1">Developer Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full rounded-lg border border-dark-800 bg-dark-950/40 p-2.5 text-dark-400 cursor-not-allowed outline-none"
              />
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="glass-panel rounded-xl p-5 border border-dark-800 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Lock size={16} className="text-indigo-400" />
            <span>Update Developer Password</span>
          </h3>

          <form onSubmit={handlePassSubmit(onChangePassword)} className="space-y-3 text-xs">
            <div>
              <label className="block text-dark-300 mb-1">New Secure Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                className={`w-full rounded-lg border bg-dark-950/50 p-2.5 text-white outline-none focus:border-indigo-500 ${
                  passErrors.newPassword ? 'border-red-500/40' : 'border-dark-800'
                }`}
                {...registerPass('newPassword', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Password must be at least 6 characters' }
                })}
              />
              {passErrors.newPassword && (
                <p className="mt-1 text-[10px] text-red-400">{passErrors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-dark-300 mb-1">Confirm New Password</label>
              <input
                type="password"
                placeholder="Confirm new password"
                className={`w-full rounded-lg border bg-dark-950/50 p-2.5 text-white outline-none focus:border-indigo-500 ${
                  passErrors.confirmPassword ? 'border-red-500/40' : 'border-dark-800'
                }`}
                {...registerPass('confirmPassword', {
                  required: 'Confirm password is required',
                  validate: (val, formVals) => val === formVals.newPassword || 'Passwords do not match'
                })}
              />
              {passErrors.confirmPassword && (
                <p className="mt-1 text-[10px] text-red-400">{passErrors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer pt-2 mt-4"
            >
              <Save size={14} />
              <span>{loading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        </div>

        {/* Database Restore Action (Simulation UI) */}
        <div className="glass-panel rounded-xl p-5 border border-dark-800 space-y-4 md:col-span-2">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Database size={16} className="text-indigo-400" />
            <span>Database Backup Recovery (Restore Simulation)</span>
          </h3>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-950/40 p-4 rounded-lg border border-dark-850">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">Database Restoration panel (UI simulation)</p>
              <p className="text-[11px] text-dark-400">Upload a `.sql` dump backup generated from this panel to restore tables and row states.</p>
            </div>
            
            <button
              onClick={handleTriggerRestore}
              disabled={restoreLoading}
              className="flex items-center justify-center space-x-1.5 rounded-lg border border-dark-800 hover:border-indigo-500/30 bg-dark-900 px-4 py-2.5 text-xs font-semibold text-dark-200 hover:text-white disabled:opacity-50 cursor-pointer"
            >
              <RefreshCcw size={14} className={restoreLoading ? 'animate-spin' : ''} />
              <span>Simulate Recovery Process</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

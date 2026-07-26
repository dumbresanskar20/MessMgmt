import React, { useState, useEffect } from 'react';
import { Clock, Save, Check, AlertCircle, Sparkles, Sun, CheckCircle } from 'lucide-react';
import api from '../services/api';

export default function MealTimings() {
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingMap, setSavingMap] = useState({});
  const [notification, setNotification] = useState(null);

  const MEAL_ICONS = {
    breakfast: '🌅',
    lunch: '☀️',
    snacks: '☕',
    dinner: '🌙',
  };

  useEffect(() => {
    fetchMealWindows();
  }, []);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchMealWindows = async () => {
    setLoading(true);
    try {
      const res = await api.get('/menu/windows');
      if (res.data.success) {
        const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const existingMap = {};
        (res.data.windows || []).forEach((w) => {
          existingMap[w.meal_type.toLowerCase()] = w;
        });

        const fullWindows = mealOrder.map((type) => {
          if (existingMap[type]) {
            return { ...existingMap[type] };
          }
          return {
            meal_type: type,
            start_time: '08:00',
            end_time: '20:00',
            is_active: true,
            is_full_day: false,
          };
        });

        setWindows(fullWindows);
      }
    } catch (err) {
      showToast('Error loading meal window timings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = (index) => {
    const updated = [...windows];
    updated[index].is_active = !updated[index].is_active;
    setWindows(updated);
  };

  const handleToggleFullDay = (index) => {
    const updated = [...windows];
    updated[index].is_full_day = !updated[index].is_full_day;
    setWindows(updated);
  };

  const handleTimingChange = (index, field, value) => {
    const updated = [...windows];
    updated[index][field] = value;
    setWindows(updated);
  };

  const handleSaveWindow = async (windowItem, index) => {
    setSavingMap((prev) => ({ ...prev, [windowItem.meal_type]: true }));
    try {
      const res = await api.put(`/menu/windows/${windowItem.meal_type}`, {
        start_time: windowItem.start_time,
        end_time: windowItem.end_time,
        is_active: windowItem.is_active,
        is_full_day: windowItem.is_full_day,
      });

      if (res.data.success && res.data.window) {
        const updated = [...windows];
        updated[index] = res.data.window;
        setWindows(updated);
      }

      const activeStatusText = windowItem.is_active ? 'ACTIVE' : 'OFFERED OFF';
      const timingText = windowItem.is_full_day
        ? 'Full Day Ordering Enabled'
        : `Window ${windowItem.start_time} - ${windowItem.end_time}`;
      showToast(`${windowItem.meal_type.toUpperCase()} saved: ${activeStatusText} (${timingText})!`);
    } catch (err) {
      showToast('Couldn\'t save timing updates.', 'error');
    } finally {
      setSavingMap((prev) => ({ ...prev, [windowItem.meal_type]: false }));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      
      {notification && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl border font-bold text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
          notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-600" /> : <Check className="w-5 h-5 text-emerald-600" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100/80 text-amber-800 rounded-full text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Canteen Offerings & Operating Hours</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Meal Type & Timing Settings</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Configure meal offering availability (ON/OFF), Full-Day 24/7 ordering, or specific time windows for Breakfast, Lunch, Snacks, & Dinner.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-extrabold text-slate-700">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>4 Meal Categories</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading database meal configuration...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {windows.map((w, idx) => {
            const icon = MEAL_ICONS[w.meal_type.toLowerCase()] || '🍱';
            const isSaving = savingMap[w.meal_type];

            return (
              <div
                key={w.meal_type}
                className={`bg-white rounded-3xl border transition-all p-6 space-y-5 shadow-sm ${
                  w.is_active ? 'border-slate-200 shadow-sm' : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                {/* Header & Active Toggle */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h3 className="font-black text-lg capitalize text-slate-900">{w.meal_type}</h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {w.is_active ? 'Shown in Student App' : 'Hidden from Student App'}
                      </p>
                    </div>
                  </div>

                  {/* Active Switch */}
                  <div className="flex items-center gap-2 bg-slate-100/80 p-2 rounded-2xl border border-slate-200/60">
                    <span className={`text-xs font-black uppercase tracking-wider ${w.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {w.is_active ? 'Active' : 'Offered Off'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(idx)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                        w.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                          w.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Full Day Toggle */}
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  w.is_full_day ? 'bg-emerald-50/80 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className={`w-4 h-4 ${w.is_full_day ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Full-Day Ordering
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase ${w.is_full_day ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {w.is_full_day ? 'ON (24/7)' : 'OFF (Time Window)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleFullDay(idx)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          w.is_full_day ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                            w.is_full_day ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Plain-Language Confirmation Text */}
                  {w.is_full_day ? (
                    <p className="text-[11px] font-bold text-emerald-800 mt-2 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{w.meal_type.charAt(0).toUpperCase() + w.meal_type.slice(1)} will be orderable all day, with no time restriction.</span>
                    </p>
                  ) : (
                    <p className="text-[11px] font-semibold text-slate-500 mt-2">
                      Ordering is restricted between opening and closing time window hours below.
                    </p>
                  )}
                </div>

                {/* Operating Window Hours (Grayed out when is_full_day is ON or is_active is OFF) */}
                <div className={`transition-all space-y-3 ${w.is_full_day || !w.is_active ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Time Window Hours
                    </span>
                    {w.is_full_day && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        Time fields ignored while Full-Day is ON
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Opening Time</label>
                      <input
                        type="time"
                        value={w.start_time || '08:00'}
                        onChange={(e) => handleTimingChange(idx, 'start_time', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Closing Time</label>
                      <input
                        type="time"
                        value={w.end_time || '20:00'}
                        onChange={(e) => handleTimingChange(idx, 'end_time', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Save CTA */}
                <button
                  onClick={() => handleSaveWindow(w, idx)}
                  disabled={isSaving}
                  className={`w-full py-3 font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                    w.is_active
                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  {isSaving ? (
                    <span>Saving to Database...</span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save {w.meal_type.toUpperCase()} Settings</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

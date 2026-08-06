import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Users, ShieldAlert, Utensils, ShoppingBag, CreditCard, 
  Database, Activity, CheckCircle2, AlertTriangle, Play, Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';

// Colors for Pie Charts
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  
  // 1. Fetch Stats Cards & System status
  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ['devDashboardStats'],
    queryFn: async () => {
      const res = await axios.get('/api/developer/dashboard/stats');
      return res.data;
    },
    refetchInterval: 15000, // Refresh every 15s
  });

  // 2. Fetch Chart Data
  const { data: chartsData, isLoading: isChartsLoading } = useQuery({
    queryKey: ['devDashboardCharts'],
    queryFn: async () => {
      const res = await axios.get('/api/developer/dashboard/charts');
      return res.data;
    },
  });

  // 3. Fetch Recent Activities
  const { data: activitiesData, isLoading: isActivitiesLoading } = useQuery({
    queryKey: ['devDashboardActivities'],
    queryFn: async () => {
      const res = await axios.get('/api/developer/dashboard/activities');
      return res.data;
    },
    refetchInterval: 10000, // Refresh every 10s for live feel
  });

  if (isStatsLoading || isChartsLoading || isActivitiesLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm text-dark-400">Loading Developer Dashboard...</p>
        </div>
      </div>
    );
  }

  const cards = statsData?.cards || {};
  const sysStatus = statsData?.systemStatus || {};

  // Formatter for database size (Bytes -> MB/KB)
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const statCards = [
    { title: 'Total Students', value: cards.totalStudents, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/5' },
    { title: 'Total Admin Users', value: cards.totalAdmins, icon: ShieldAlert, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
    { title: 'Total Menu Items', value: cards.totalMenuItems, icon: Utensils, color: 'text-amber-400', bg: 'bg-amber-500/5' },
    { title: 'Total Orders', value: cards.totalOrders, icon: ShoppingBag, color: 'text-purple-400', bg: 'bg-purple-500/5' },
    { title: 'Today\'s Orders', value: cards.todayOrders, icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/5' },
    { title: 'Active Subscriptions', value: cards.activeSubscriptions, icon: CreditCard, color: 'text-pink-400', bg: 'bg-pink-500/5' },
    { title: 'Database Size', value: formatBytes(cards.databaseSize), icon: Database, color: 'text-cyan-400', bg: 'bg-cyan-500/5' },
    { title: 'Total Tables', value: cards.totalTables, icon: Database, color: 'text-rose-400', bg: 'bg-rose-500/5' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between space-y-4 md:flex-row md:items-center md:space-y-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Developer Management Control Center</span>
            <Sparkles size={16} className="text-indigo-400 animate-pulse" />
          </h2>
          <p className="text-sm text-dark-400">Live operational overview, metrics visualization, and system monitoring.</p>
        </div>
        
        {/* System Status Indicators */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(sysStatus).map(([service, status]) => (
            <div 
              key={service} 
              className="flex items-center space-x-1.5 rounded-full border border-dark-800 bg-dark-900/60 px-3 py-1 text-xs"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="capitalize text-dark-300">{service}:</span>
              <span className="font-semibold text-white">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">{card.title}</span>
                <div className={`rounded-lg p-2 ${card.color} ${card.bg}`}>
                  <Icon size={18} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline">
                <span className="text-2xl font-bold text-white tracking-tight">{card.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue Grid - Today / Monthly / Total */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-5 border-l-2 border-indigo-500">
          <span className="text-xs text-dark-400 block">Today's Revenue</span>
          <span className="text-xl font-bold text-white mt-1 block">₹{cards.todayRevenue.toFixed(2)}</span>
        </div>
        <div className="glass-card rounded-xl p-5 border-l-2 border-emerald-500">
          <span className="text-xs text-dark-400 block">Monthly Revenue</span>
          <span className="text-xl font-bold text-white mt-1 block">₹{cards.monthlyRevenue.toFixed(2)}</span>
        </div>
        <div className="glass-card rounded-xl p-5 border-l-2 border-amber-500">
          <span className="text-xs text-dark-400 block">Total Collected Revenue</span>
          <span className="text-xl font-bold text-white mt-1 block">₹{cards.totalRevenue.toFixed(2)}</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue & Orders Trend LineChart */}
        <div className="glass-panel rounded-xl p-5 border border-dark-800">
          <h3 className="text-sm font-semibold text-white mb-4">Revenue & Orders Trend (Last 7 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartsData?.orderTrend || []}>
                <XAxis dataKey="label" stroke="#48485a" fontSize={11} />
                <YAxis yAxisId="left" stroke="#48485a" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="#48485a" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1b1b22', borderColor: '#26262e' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#6366f1" strokeWidth={2} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders Count" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Students Registration growth BarChart */}
        <div className="glass-panel rounded-xl p-5 border border-dark-800">
          <h3 className="text-sm font-semibold text-white mb-4">New Student Registrations (Last 5 Months)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData?.studentsGrowth || []}>
                <XAxis dataKey="month" stroke="#48485a" fontSize={11} />
                <YAxis stroke="#48485a" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1b1b22', borderColor: '#26262e' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="registrations" name="New Students" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Meal Distribution PieChart */}
        <div className="glass-panel rounded-xl p-5 border border-dark-800">
          <h3 className="text-sm font-semibold text-white mb-4">Meal Sales Distribution</h3>
          <div className="h-64 flex flex-col justify-center items-center">
            {chartsData?.mealDistribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartsData.mealDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartsData.mealDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1b1b22', borderColor: '#26262e' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-dark-500">No data available</p>
            )}
          </div>
        </div>

        {/* Payment Methods PieChart */}
        <div className="glass-panel rounded-xl p-5 border border-dark-800">
          <h3 className="text-sm font-semibold text-white mb-4">Payment Method Distribution</h3>
          <div className="h-64 flex flex-col justify-center items-center">
            {chartsData?.paymentDistribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartsData.paymentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartsData.paymentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1b1b22', borderColor: '#26262e' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-dark-500">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline and Logs */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Audit Logs (Developer Panel activity) */}
        <div className="glass-panel rounded-xl p-5 border border-dark-800 flex flex-col max-h-[450px]">
          <h3 className="text-sm font-semibold text-white mb-3">Live Developer Actions Log</h3>
          <div className="overflow-y-auto flex-1 space-y-3.5 pr-2">
            {activitiesData?.auditLogs?.length > 0 ? (
              activitiesData.auditLogs.map((log) => (
                <div key={log.id} className="flex items-start space-x-3 text-xs border-b border-dark-850 pb-2">
                  <div className="mt-0.5 rounded-full bg-indigo-500/10 p-1 text-indigo-400">
                    <CheckCircle2 size={12} />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p className="font-semibold text-white">{log.action}</p>
                    <p className="text-dark-400 text-[10px]">
                      By <span className="text-dark-200">{log.user_email}</span> in module <span className="text-indigo-400 uppercase font-mono">{log.module}</span>
                    </p>
                    <p className="text-[10px] text-dark-500">
                      IP: {log.ip_address || 'local'} • Browser: {log.browser ? log.browser.substring(0, 45) + '...' : 'Unknown'}
                    </p>
                  </div>
                  <span className="text-[10px] text-dark-500 shrink-0">{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-dark-500 p-4 text-center">No developer actions logged yet.</p>
            )}
          </div>
        </div>

        {/* Recent Logins */}
        <div className="glass-panel rounded-xl p-5 border border-dark-800 flex flex-col max-h-[450px]">
          <h3 className="text-sm font-semibold text-white mb-3">Recent Authentication Events</h3>
          <div className="overflow-y-auto flex-1 space-y-3.5 pr-2">
            {activitiesData?.logins?.length > 0 ? (
              activitiesData.logins.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs border-b border-dark-850 pb-2">
                  <div className="flex items-center space-x-3">
                    <div className="rounded-full bg-emerald-500/10 p-1 text-emerald-400">
                      <Play size={12} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Developer Login Success</p>
                      <p className="text-dark-400 text-[10px]">{log.user_email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-dark-500">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-dark-500 p-4 text-center">No recent login events recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

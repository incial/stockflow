import React, { useEffect, useState } from 'react';
import { AdminDashboardData } from '../types';
import { formatCurrency } from '../utils/calculations';
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { TrendingUp, Package, Percent, ArrowUpRight, ArrowDownRight, Activity, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const AdminDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const emptyDashboard: AdminDashboardData = {
    totalRevenue: 0,
    totalProfit: 0,
    avgMargin: 0,
    totalItems: 0,
    profitByOutlet: [],
    trendData: []
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (!api.session.hasAdminSession()) {
        setDashboard(emptyDashboard);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setDashboard(await api.admin.getDashboard());
      } catch (error: any) {
        setDashboard(emptyDashboard);
        addToast(error.message || 'Failed to load dashboard', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [addToast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] sm:min-h-[400px] text-slate-400">
        <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const stats = dashboard ?? emptyDashboard;

  return (
    <div className="space-y-5 sm:space-y-8 pb-8 sm:pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 mb-1 sm:mb-2">
        <div>
          <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight">Overview</h2>
          <p className="text-slate-500 mt-1 text-sm sm:text-lg">Global performance analytics.</p>
        </div>
        <div className="glass-panel self-start md:self-auto px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 text-xs sm:text-sm text-slate-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          System Operational
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<TrendingUp size={24} />}
          trend="+12.5%"
          positive={true}
          delay="0ms"
        />
        <KpiCard
          title="Net Profit"
          value={formatCurrency(stats.totalProfit)}
          icon={<Activity size={24} />}
          trend="+8.2%"
          positive={true}
          color="indigo"
          delay="100ms"
        />
        <KpiCard
          title="Avg. Margin"
          value={`${Number.isNaN(stats.avgMargin) ? 0 : stats.avgMargin.toFixed(1)}%`}
          icon={<Percent size={24} />}
          trend="-1.4%"
          positive={false}
          color="emerald"
          delay="200ms"
        />
        <KpiCard
          title="Units Flow"
          value={stats.totalItems.toLocaleString()}
          icon={<Package size={24} />}
          trend="+22.1%"
          positive={true}
          color="amber"
          delay="300ms"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 glass-panel p-4 sm:p-8 rounded-[24px] sm:rounded-[32px] flex flex-col min-h-[320px] sm:min-h-[400px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 sm:mb-8">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800">Financial Trend</h3>
              <p className="text-sm text-slate-400">Revenue vs Profit over time</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50/50 border border-indigo-100">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                <span className="text-xs font-bold text-indigo-700">Revenue</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50/50 border border-emerald-100">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                <span className="text-xs font-bold text-emerald-700">Profit</span>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.5)',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-8 rounded-[24px] sm:rounded-[32px] flex flex-col">
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-1">Outlet Share</h3>
          <p className="text-sm text-slate-400 mb-6">Profit distribution</p>

          <div className="flex-1 min-h-[220px] sm:min-h-[250px] relative">
            {stats.profitByOutlet.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.profitByOutlet}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="profit"
                    cornerRadius={6}
                  >
                    {stats.profitByOutlet.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(8px)',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                No data available
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-slate-800 opacity-20">{stats.profitByOutlet.length}</span>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 space-y-2.5 sm:space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
            {stats.profitByOutlet.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-sm group cursor-pointer hover:bg-slate-50/50 p-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-sm transition-transform group-hover:scale-125" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-600 font-semibold">{entry.name}</span>
                </div>
                <span className="font-bold text-slate-800 font-mono">{formatCurrency(entry.profit)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface KpiProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
  positive: boolean;
  color?: 'slate' | 'indigo' | 'emerald' | 'amber';
  delay: string;
}

const KpiCard: React.FC<KpiProps> = ({ title, value, icon, trend, positive, color = 'slate', delay }) => {
  const colorMap = {
    slate: 'from-slate-500 to-slate-600 shadow-slate-500/30',
    indigo: 'from-indigo-500 to-violet-600 shadow-indigo-500/30',
    emerald: 'from-emerald-400 to-teal-500 shadow-emerald-500/30',
    amber: 'from-amber-400 to-orange-500 shadow-amber-500/30',
  };

  const iconBgMap = {
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div
      className="glass-panel p-6 rounded-[28px] relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={`p-3 rounded-2xl ${iconBgMap[color]} transition-colors group-hover:bg-white group-hover:shadow-md`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-sm ${positive ? 'bg-emerald-100/50 text-emerald-700' : 'bg-rose-100/50 text-rose-700'}`}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-sm font-semibold text-slate-500 mb-1 tracking-wide">{title}</p>
        <h4 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h4>
      </div>

      <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br ${colorMap[color]} rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500`}></div>
    </div>
  );
};

export default AdminDashboard;

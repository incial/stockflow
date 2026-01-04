
import React, { useMemo } from 'react';
import { StockEntry, Product, Outlet } from '../types';
import { calculateEntryMetrics, formatCurrency } from '../utils/calculations';
import { 
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, 
  Tooltip, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { TrendingUp, Package, Percent, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface AdminDashboardProps {
  entries: StockEntry[];
  products: Product[];
  outlets: Outlet[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ entries, products, outlets }) => {
  const enrichedEntries = useMemo(() => 
    entries.map(e => calculateEntryMetrics(e, products, outlets)),
    [entries, products, outlets]
  );

  const stats = useMemo(() => {
    const totalRevenue = enrichedEntries.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalProfit = enrichedEntries.reduce((acc, curr) => acc + curr.profit, 0);
    const avgMargin = enrichedEntries.length > 0 ? totalProfit / totalRevenue * 100 : 0;
    const totalItems = enrichedEntries.reduce((acc, curr) => acc + curr.quantity, 0);

    return { totalRevenue, totalProfit, avgMargin, totalItems };
  }, [enrichedEntries]);

  // Chart data: Profit by Outlet
  const profitByOutlet = useMemo(() => {
    const data: Record<string, number> = {};
    enrichedEntries.forEach(e => {
      data[e.outletName] = (data[e.outletName] || 0) + e.profit;
    });
    return Object.entries(data).map(([name, profit]) => ({ name, profit }));
  }, [enrichedEntries]);

  // Chart data: Trend over time
  const trendData = useMemo(() => {
    const data: Record<string, { revenue: number, profit: number }> = {};
    enrichedEntries.sort((a,b) => a.entryDate.localeCompare(b.entryDate)).forEach(e => {
      if (!data[e.entryDate]) data[e.entryDate] = { revenue: 0, profit: 0 };
      data[e.entryDate].revenue += e.revenue;
      data[e.entryDate].profit += e.profit;
    });
    return Object.entries(data).map(([date, values]) => ({ date, ...values }));
  }, [enrichedEntries]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h2 className="text-4xl font-light text-slate-900 tracking-tight">Overview</h2>
          <p className="text-slate-500 mt-1 text-lg">Global performance analytics.</p>
        </div>
        <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 text-sm text-slate-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            System Operational
        </div>
      </header>

      {/* Bento Grid - KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          value={`${isNaN(stats.avgMargin) ? 0 : stats.avgMargin.toFixed(1)}%`} 
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

      {/* Bento Grid - Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-[32px] flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <div>
                <h3 className="text-xl font-bold text-slate-800">Financial Trend</h3>
                <p className="text-sm text-slate-400">Revenue vs Profit over time</p>
            </div>
            <div className="flex gap-4">
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
              <AreaChart data={trendData}>
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

        {/* Breakdown by Outlet */}
        <div className="glass-panel p-8 rounded-[32px] flex flex-col">
          <h3 className="text-xl font-bold text-slate-800 mb-1">Outlet Share</h3>
          <p className="text-sm text-slate-400 mb-6">Profit distribution</p>
          
          <div className="flex-1 min-h-[250px] relative">
            {profitByOutlet.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={profitByOutlet}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="profit"
                    cornerRadius={6}
                  >
                    {profitByOutlet.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
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
            
            {/* Center Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-slate-800 opacity-20">{profitByOutlet.length}</span>
            </div>
          </div>
          
          <div className="mt-6 space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
            {profitByOutlet.map((entry, index) => (
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
      
      {/* Decorative Glow */}
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br ${colorMap[color]} rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500`}></div>
    </div>
  );
};

export default AdminDashboard;

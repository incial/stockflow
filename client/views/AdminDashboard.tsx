
import React, { useMemo } from 'react';
import { StockEntry, Product } from '../types';
import { MOCK_OUTLETS } from '../constants';
import { calculateEntryMetrics, formatCurrency } from '../utils/calculations';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Package, Store, Percent, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface AdminDashboardProps {
  entries: StockEntry[];
  products: Product[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ entries, products }) => {
  const enrichedEntries = useMemo(() => 
    entries.map(e => calculateEntryMetrics(e, products, MOCK_OUTLETS)),
    [entries, products]
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

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Global Overview</h2>
        <p className="text-slate-500">Consolidated analytics across all registered outlets.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Total Revenue" 
          value={formatCurrency(stats.totalRevenue)} 
          icon={<TrendingUp size={20} />} 
          trend="+12.5%" 
          positive={true} 
        />
        <KpiCard 
          title="Total Profit" 
          value={formatCurrency(stats.totalProfit)} 
          icon={<ArrowUpRight size={20} />} 
          trend="+8.2%" 
          positive={true} 
          color="indigo"
        />
        <KpiCard 
          title="Average Margin" 
          value={`${isNaN(stats.avgMargin) ? 0 : stats.avgMargin.toFixed(1)}%`} 
          icon={<Percent size={20} />} 
          trend="-1.4%" 
          positive={false} 
          color="emerald"
        />
        <KpiCard 
          title="Units Stocked" 
          value={stats.totalItems.toLocaleString()} 
          icon={<Package size={20} />} 
          trend="+22.1%" 
          positive={true} 
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Revenue vs Profit Trend</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span className="text-xs font-medium text-slate-500">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                <span className="text-xs font-medium text-slate-500">Profit</span>
              </div>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown by Outlet */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6">Profit by Outlet</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={profitByOutlet}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="profit"
                >
                  {profitByOutlet.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {profitByOutlet.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-600 font-medium">{entry.name}</span>
                </div>
                <span className="font-bold text-slate-800">{formatCurrency(entry.profit)}</span>
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
}

const KpiCard: React.FC<KpiProps> = ({ title, value, icon, trend, positive, color = 'slate' }) => {
  const colorMap = {
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-xl ${colorMap[color]}`}>{icon}</div>
        <div className={`flex items-center gap-0.5 text-xs font-bold ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-500 mb-1">{title}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </div>
  );
};

export default AdminDashboard;

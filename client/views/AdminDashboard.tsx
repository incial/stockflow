import React from 'react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { Activity, Package, Percent, PieChart as PieIcon, RefreshCw, TrendingUp } from 'lucide-react';
import { AdminDashboardData } from '../types';
import { api } from '../services/api';
import { session } from '../services/session';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { EmptyState, Loading, PageHeader, ProgressBar, StatCard } from '../components/ui';

const COLORS = ['#4f46e5', '#059669', '#d97706', '#e11d48', '#7c3aed', '#db2777', '#0891b2'];

const EMPTY: AdminDashboardData = {
  totalRevenue: 0,
  totalProfit: 0,
  avgMargin: 0,
  totalItems: 0,
  profitByOutlet: [],
  trendData: [],
};

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 20px -8px rgba(15,23,42,0.2)',
  fontSize: 12,
};

const compactCurrency = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

const AdminDashboard: React.FC = () => {
  const { data: stats, initialLoading, loading, reload } = useAsyncData(
    (signal) => (session.isAdmin() ? api.admin.getDashboard(signal) : Promise.resolve(EMPTY)),
    [],
    EMPTY,
    'Failed to load dashboard'
  );

  if (initialLoading) return <Loading label="Loading dashboard…" />;

  const margin = Number.isFinite(stats.avgMargin) ? stats.avgMargin : 0;

  return (
    <div className="stack-lg page">
      <ProgressBar active={loading} />
      <PageHeader
        title="Overview"
        subtitle="Performance across all outlets."
        actions={
          <button className="btn btn-outline" onClick={reload} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
        }
      />

      <div className="stats">
        <StatCard label="Total revenue" value={formatCurrency(stats.totalRevenue)} icon={<TrendingUp size={16} />} />
        <StatCard label="Net profit" value={formatCurrency(stats.totalProfit)} icon={<Activity size={16} />} tone="success" alert={stats.totalProfit < 0} />
        <StatCard label="Avg. margin" value={`${margin.toFixed(1)}%`} icon={<Percent size={16} />} tone="warning" />
        <StatCard label="Units stocked" value={formatNumber(stats.totalItems)} icon={<Package size={16} />} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Financial trend</h2>
              <p className="card-sub">Revenue vs profit over time</p>
            </div>
            <div className="legend">
              <span><i style={{ background: COLORS[0] }} />Revenue</span>
              <span><i style={{ background: COLORS[1] }} />Profit</span>
            </div>
          </div>
          <div className="card-pad">
            {stats.trendData.length > 0 ? (
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS[1]} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={COLORS[1]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tickFormatter={(v: number) => compactCurrency.format(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Area type="monotone" name="Revenue" dataKey="revenue" stroke={COLORS[0]} strokeWidth={2} fill="url(#gRev)" isAnimationActive={false} />
                    <Area type="monotone" name="Profit" dataKey="profit" stroke={COLORS[1]} strokeWidth={2} fill="url(#gProf)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={<TrendingUp size={24} />} title="No trend data yet" />
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Outlet share</h2>
              <p className="card-sub">Profit distribution</p>
            </div>
          </div>
          <div className="card-pad">
            {stats.profitByOutlet.length > 0 ? (
              <>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.profitByOutlet as unknown as Record<string, unknown>[]}
                        dataKey="profit"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={84}
                        paddingAngle={3}
                        isAnimationActive={false}
                      >
                        {stats.profitByOutlet.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ marginTop: 12 }}>
                  {stats.profitByOutlet.map((entry, index) => (
                    <div key={`${entry.name}-${index}`} className="list-row">
                      <span className="row">
                        <i style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[index % COLORS.length] }} />
                        {entry.name}
                      </span>
                      <span className={`num strong ${entry.profit < 0 ? 'text-danger' : ''}`}>{formatCurrency(entry.profit)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={<PieIcon size={24} />} title="No outlet data" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;

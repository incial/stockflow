
import React, { useState, useMemo, useEffect } from 'react';
import { StockEntry, Product, EnrichedStockEntry, Outlet } from '../types';
import { calculateEntryMetrics } from '../utils/calculations';
import { FileDown, CalendarDays, Filter } from 'lucide-react';

interface ReportsProps {
  entries: StockEntry[];
  products: Product[];
  outlets: Outlet[];
}

interface ReportDataState {
  data: Record<string, Record<string, EnrichedStockEntry>>;
  sortedDates: string[];
}

const Reports: React.FC<ReportsProps> = ({ entries, products, outlets }) => {
  const [filterOutlet, setFilterOutlet] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const reportData = useMemo<ReportDataState>(() => {
    const data: Record<string, Record<string, EnrichedStockEntry>> = {};
    const datesSet = new Set<string>();

    entries.forEach(e => {
      if (filterOutlet && e.outletId !== filterOutlet) return;
      
      const metrics = calculateEntryMetrics(e, products, outlets);
      const date = e.entryDate;
      datesSet.add(date);

      if (!data[date]) data[date] = {};
      data[date][e.productId] = metrics;
    });

    const sortedDates = Array.from(datesSet).sort().reverse();
    return { data, sortedDates };
  }, [entries, products, outlets, filterOutlet]);

  useEffect(() => {
    if (reportData.sortedDates.length > 0 && !selectedDate) {
      setSelectedDate(reportData.sortedDates[0]);
    }
  }, [reportData.sortedDates, selectedDate]);

  const brands = useMemo<Record<string, Product[]>>(() => {
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
      if (!grouped[p.brand]) grouped[p.brand] = [];
      grouped[p.brand].push(p);
    });
    return grouped;
  }, [products]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const currentData = selectedDate ? reportData.data[selectedDate] : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-light text-slate-900 tracking-tight">Detailed Reports</h2>
          <p className="text-slate-500 mt-1 text-lg">Daily consolidated metrics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Outlet Filter */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm">
            <Filter size={18} className="text-slate-400" />
            <select 
              value={filterOutlet} 
              onChange={(e) => {
                setFilterOutlet(e.target.value);
                setSelectedDate(null);
              }}
              className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
            >
              <option value="">All Outlets</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <button 
            onClick={() => alert("Generating Excel Export for " + selectedDate)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5"
          >
            <FileDown size={20} />
            Export Excel
          </button>
        </div>
      </header>

      {/* Date Switcher */}
      <section className="glass-panel p-2 rounded-2xl overflow-x-auto scrollbar-hide w-full">
        <div className="flex items-center gap-2 min-w-max">
          <div className="px-4 py-2 text-slate-400 border-r border-slate-200/50 mr-2 flex items-center gap-2">
            <CalendarDays size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Date</span>
          </div>
          {reportData.sortedDates.length > 0 ? (
            reportData.sortedDates.map((date, idx) => (
              <button
                key={date}
                onClick={() => handleDateChange(date)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-transparent ${
                  selectedDate === date 
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                    : 'text-slate-500 hover:bg-white/50 hover:border-white/50 hover:text-slate-800'
                }`}
              >
                {date}
                {idx === 0 && (
                  <span className="ml-2 inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                )}
              </button>
            ))
          ) : (
            <span className="text-sm text-slate-400 px-4 py-2 italic">No entry dates found.</span>
          )}
        </div>
      </section>

      {selectedDate && currentData ? (
        <div className="glass-panel rounded-[32px] overflow-hidden shadow-xl ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4 w-16 border-r border-white/10">Sl</th>
                  <th className="px-6 py-4 w-1/3 border-r border-white/10">Item Description</th>
                  <th className="px-6 py-4 w-24 border-r border-white/10 text-center">MRP</th>
                  <th className="px-4 py-4 text-center border-r border-white/10">Stock</th>
                  <th className="px-4 py-4 text-center border-r border-white/10">Cost</th>
                  <th className="px-4 py-4 text-center border-r border-white/10">Profit</th>
                  <th className="px-4 py-4 text-center border-r border-white/10">Mgn/Btl</th>
                  <th className="px-4 py-4 text-center">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {(Object.entries(brands) as [string, Product[]][]).map(([brand, products]) => {
                  const filteredProducts = products.filter(p => currentData[p.id]);
                  if (filteredProducts.length === 0) return null;

                  const brandTotalAmt = filteredProducts.reduce((sum, p) => sum + (currentData[p.id]?.amount || 0), 0);
                  const brandTotalProfit = filteredProducts.reduce((sum, p) => sum + (currentData[p.id]?.profit || 0), 0);

                  return (
                    <React.Fragment key={brand}>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <td colSpan={8} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500">
                          {brand}
                        </td>
                      </tr>
                      {filteredProducts.map((p, idx) => {
                        const cell = currentData[p.id];
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 border-b border-slate-100/50 group transition-colors">
                            <td className="px-6 py-3 text-[10px] text-slate-400 font-mono border-r border-slate-100/50">{idx + 1}</td>
                            <td className="px-6 py-3 text-sm font-semibold text-slate-700 border-r border-slate-100/50 truncate">{p.name}</td>
                            <td className="px-6 py-3 text-[10px] text-center font-mono text-slate-500 border-r border-slate-100/50">{p.mrp.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center text-sm font-bold border-r border-slate-100/50 text-slate-900 bg-slate-50/30">{cell.quantity}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-indigo-600 border-r border-slate-100/50">{cell.amount.toFixed(0)}</td>
                            <td className={`px-4 py-3 text-right text-sm font-bold border-r border-slate-100/50 ${cell.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {cell.profit.toFixed(0)}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-slate-500 border-r border-slate-100/50 font-mono">{cell.marginPerBottle.toFixed(1)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                cell.margin > 20 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                                cell.margin > 10 ? 'bg-amber-50 border-amber-100 text-amber-700' : 
                                'bg-rose-50 border-rose-100 text-rose-700'
                              }`}>
                                {cell.margin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-100/50 font-bold text-[11px] border-b border-slate-200">
                        <td colSpan={4} className="px-6 py-3 text-right border-r border-slate-200/50 text-slate-400 uppercase tracking-tighter">Total for {brand}</td>
                        <td className="px-4 py-3 text-right border-r border-slate-200/50 text-indigo-700">₹{brandTotalAmt.toFixed(0)}</td>
                        <td className="px-4 py-3 text-right border-r border-slate-200/50 text-emerald-700">₹{brandTotalProfit.toFixed(0)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-[32px] p-24 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-50 text-slate-300 rounded-full mb-6">
            <CalendarDays size={40} />
          </div>
          <div>
            <h3 className="text-2xl font-light text-slate-800">No Data Selected</h3>
            <p className="text-slate-500 mt-2 text-lg">Please select a date from the timeline above.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;


import React, { useState, useMemo } from 'react';
import { StockEntry, StockOutEntry, Product } from '../types';
import { MOCK_OUTLETS, MOCK_USERS } from '../constants';
import { getAvailableStock, formatDate } from '../utils/calculations';
import { PackageMinus, Filter, History, Layers, ArrowRightLeft, Search, X } from 'lucide-react';

interface InventoryReportProps {
  entries: StockEntry[];
  stockOuts: StockOutEntry[];
  products: Product[];
}

type Tab = 'levels' | 'history';

const InventoryReport: React.FC<InventoryReportProps> = ({ entries, stockOuts, products }) => {
  const [activeTab, setActiveTab] = useState<Tab>('levels');
  const [filterOutlet, setFilterOutlet] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const inventoryLevels = useMemo(() => {
    const levels: Array<{
      productId: string;
      productName: string;
      brand: string;
      outletId: string;
      outletName: string;
      totalIn: number;
      totalOut: number;
      available: number;
    }> = [];
    const lowerQuery = searchQuery.toLowerCase().trim();

    MOCK_OUTLETS.forEach(outlet => {
      if (filterOutlet && outlet.id !== filterOutlet) return;
      products.forEach(product => {
        if (lowerQuery) {
          const matches = product.name.toLowerCase().includes(lowerQuery) || product.brand.toLowerCase().includes(lowerQuery);
          if (!matches) return;
        }
        const totalIn = entries.filter(e => e.outletId === outlet.id && e.productId === product.id).reduce((sum, e) => sum + e.quantity, 0);
        const totalOut = stockOuts.filter(e => e.outletId === outlet.id && e.productId === product.id).reduce((sum, e) => sum + e.quantity, 0);

        if (totalIn > 0 || totalOut > 0) {
          levels.push({
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            outletId: outlet.id,
            outletName: outlet.name,
            totalIn,
            totalOut,
            available: totalIn - totalOut
          });
        }
      });
    });
    return levels;
  }, [entries, stockOuts, products, filterOutlet, searchQuery]);

  const historyLog = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase().trim();
    return stockOuts.filter(entry => {
        if (filterOutlet && entry.outletId !== filterOutlet) return false;
        if (lowerQuery) {
           const product = products.find(p => p.id === entry.productId);
           const user = MOCK_USERS.find(u => u.id === entry.enteredBy);
           const outlet = MOCK_OUTLETS.find(o => o.id === entry.outletId);
           const matches = 
             (product?.name || '').toLowerCase().includes(lowerQuery) ||
             (product?.brand || '').toLowerCase().includes(lowerQuery) ||
             (user?.name || '').toLowerCase().includes(lowerQuery) ||
             (outlet?.name || '').toLowerCase().includes(lowerQuery) ||
             entry.reason.toLowerCase().includes(lowerQuery);
           if (!matches) return false;
        }
        return true;
      })
      .map(entry => {
        const product = products.find(p => p.id === entry.productId);
        const outlet = MOCK_OUTLETS.find(o => o.id === entry.outletId);
        const user = MOCK_USERS.find(u => u.id === entry.enteredBy);
        return {
          ...entry,
          productName: product?.name || 'Unknown',
          brand: product?.brand || 'Unknown',
          outletName: outlet?.name || 'Unknown',
          userName: user?.name || 'Unknown'
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stockOuts, products, filterOutlet, searchQuery]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-light text-slate-900 tracking-tight">Inventory</h2>
          <p className="text-slate-500 mt-1 text-lg">Live stock tracking & history logs.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          {/* Search Bar */}
          <div className="relative group flex-1 xl:w-[320px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-medium transition-all shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Outlet Filter */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm min-w-max">
            <Filter size={18} className="text-slate-400" />
            <select 
              value={filterOutlet} 
              onChange={(e) => setFilterOutlet(e.target.value)}
              className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
            >
              <option value="">All Outlets</option>
              {MOCK_OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Glass Tabs */}
      <div className="flex p-1 bg-white/40 backdrop-blur-md rounded-2xl border border-white/20 w-fit">
        <button
          onClick={() => setActiveTab('levels')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'levels' 
              ? 'bg-white shadow-md text-indigo-600' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/30'
          }`}
        >
          <Layers size={16} />
          Stock Levels
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'history' 
              ? 'bg-white shadow-md text-indigo-600' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/30'
          }`}
        >
          <History size={16} />
          Movement Log
        </button>
      </div>

      {activeTab === 'levels' && (
        <div className="glass-panel rounded-[32px] overflow-hidden min-h-[500px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-wider font-bold text-slate-400 border-b border-slate-100">
                  <th className="px-8 py-5">Outlet</th>
                  <th className="px-8 py-5">Product Details</th>
                  <th className="px-8 py-5 text-center">Total In</th>
                  <th className="px-8 py-5 text-center text-rose-500">Total Out</th>
                  <th className="px-8 py-5 text-center">Net Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/50">
                {inventoryLevels.length > 0 ? (
                  inventoryLevels.map((row) => (
                    <tr key={`${row.outletId}-${row.productId}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 text-sm font-bold text-slate-700">{row.outletName}</td>
                      <td className="px-8 py-4">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-800">{row.productName}</span>
                            <span className="text-xs text-slate-500 font-medium">{row.brand}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center text-sm font-mono text-slate-600">{row.totalIn}</td>
                      <td className="px-8 py-4 text-center">
                          <span className="text-sm font-mono text-rose-600 bg-rose-50 px-2 py-1 rounded-md">-{row.totalOut}</span>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                          row.available <= 5 
                            ? 'bg-rose-100/50 border-rose-200 text-rose-700' 
                            : 'bg-emerald-100/50 border-emerald-200 text-emerald-700'
                        }`}>
                          {row.available} Units
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                      <Layers size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg">No inventory data found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="glass-panel rounded-[32px] overflow-hidden min-h-[500px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-wider font-bold text-slate-400 border-b border-slate-100">
                  <th className="px-8 py-5">Date</th>
                  <th className="px-8 py-5">Location</th>
                  <th className="px-8 py-5">Product</th>
                  <th className="px-8 py-5 text-center">Removed</th>
                  <th className="px-8 py-5">Reason</th>
                  <th className="px-8 py-5 text-right">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/50">
                {historyLog.length > 0 ? (
                  historyLog.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 text-sm font-mono text-slate-500">{formatDate(log.date)}</td>
                      <td className="px-8 py-4 text-sm font-bold text-slate-700">{log.outletName}</td>
                      <td className="px-8 py-4 text-sm text-slate-600">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{log.productName}</span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{log.brand}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-2 py-1 rounded-lg text-xs font-mono">
                           -{log.quantity}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600">
                          {log.reason}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right text-xs font-semibold text-slate-400">
                        {log.userName}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-slate-400">
                      <History size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg">No stock out history found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryReport;

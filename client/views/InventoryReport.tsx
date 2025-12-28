
import React, { useState, useMemo } from 'react';
import { StockEntry, StockOutEntry, Product } from '../types';
import { MOCK_OUTLETS, MOCK_USERS } from '../constants';
import { getAvailableStock, formatDate } from '../utils/calculations';
import { PackageMinus, Filter, History, Layers, ArrowRightLeft } from 'lucide-react';

interface InventoryReportProps {
  entries: StockEntry[];
  stockOuts: StockOutEntry[];
  products: Product[];
}

type Tab = 'levels' | 'history';

const InventoryReport: React.FC<InventoryReportProps> = ({ entries, stockOuts, products }) => {
  const [activeTab, setActiveTab] = useState<Tab>('levels');
  const [filterOutlet, setFilterOutlet] = useState('');

  // 1. Calculate Stock Levels per Product per Outlet
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

    // Iterate through all outlets and products to build the grid
    MOCK_OUTLETS.forEach(outlet => {
      if (filterOutlet && outlet.id !== filterOutlet) return;

      products.forEach(product => {
        const totalIn = entries
          .filter(e => e.outletId === outlet.id && e.productId === product.id)
          .reduce((sum, e) => sum + e.quantity, 0);

        const totalOut = stockOuts
          .filter(e => e.outletId === outlet.id && e.productId === product.id)
          .reduce((sum, e) => sum + e.quantity, 0);

        // Only add rows where there is some activity
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
  }, [entries, stockOuts, products, filterOutlet]);

  // 2. Prepare History Log
  const historyLog = useMemo(() => {
    return stockOuts
      .filter(entry => filterOutlet ? entry.outletId === filterOutlet : true)
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
  }, [stockOuts, products, filterOutlet]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Inventory & Stock Out</h2>
          <p className="text-slate-500">Monitor current stock levels and track detailed stock removal history.</p>
        </div>
        
        {/* Outlet Filter */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
          <Filter size={16} className="text-slate-400" />
          <select 
            value={filterOutlet} 
            onChange={(e) => setFilterOutlet(e.target.value)}
            className="text-sm font-semibold outline-none bg-transparent"
          >
            <option value="">All Outlets</option>
            {MOCK_OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('levels')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'levels' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers size={16} />
          Current Stock Levels
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'history' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History size={16} />
          Stock Out Logs
        </button>
      </div>

      {activeTab === 'levels' && (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100">
                  <th className="px-6 py-4">Outlet</th>
                  <th className="px-6 py-4">Brand</th>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4 text-center">Total In</th>
                  <th className="px-6 py-4 text-center text-rose-600">Total Out</th>
                  <th className="px-6 py-4 text-center">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {inventoryLevels.length > 0 ? (
                  inventoryLevels.map((row, idx) => (
                    <tr key={`${row.outletId}-${row.productId}`} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 text-sm font-bold text-slate-700">{row.outletName}</td>
                      <td className="px-6 py-3 text-xs font-semibold text-slate-500 bg-slate-50/30">{row.brand}</td>
                      <td className="px-6 py-3 text-sm text-slate-700">{row.productName}</td>
                      <td className="px-6 py-3 text-center text-sm font-medium text-slate-600">{row.totalIn}</td>
                      <td className="px-6 py-3 text-center text-sm font-medium text-rose-600 bg-rose-50/30">{row.totalOut}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                          row.available <= 5 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {row.available}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <Layers size={32} className="mx-auto mb-2 opacity-20" />
                      <p>No inventory data found for the selected filter.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Outlet</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4 text-center">Quantity Removed</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4 text-right">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historyLog.length > 0 ? (
                  historyLog.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 text-sm font-mono text-slate-500">{formatDate(log.date)}</td>
                      <td className="px-6 py-3 text-sm font-medium text-slate-700">{log.outletName}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">{log.productName}</span>
                          <span className="text-[10px] text-slate-400">{log.brand}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded-md text-xs">
                           -{log.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-100 bg-slate-50 text-xs font-medium">
                          <PackageMinus size={12} />
                          {log.reason}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-xs font-semibold text-slate-400">
                        {log.userName}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <History size={32} className="mx-auto mb-2 opacity-20" />
                      <p>No stock out records found.</p>
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

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, History, Layers, Loader2, Search, X } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { AdminInventoryData } from '../types';
import { formatDate } from '../utils/calculations';

type Tab = 'levels' | 'history';

const PAGE_SIZE = 20;

const emptyInventoryData: AdminInventoryData = {
  outlets: [],
  activeTab: 'levels',
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  search: '',
  inventoryLevels: [],
  historyLog: []
};

const InventoryReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('levels');
  const [filterOutlet, setFilterOutlet] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AdminInventoryData>(emptyInventoryData);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const loadInventory = async () => {
      try {
        setLoading(true);
        setData(await api.admin.getInventory(
          filterOutlet ? Number(filterOutlet) : undefined,
          activeTab,
          page,
          PAGE_SIZE,
          appliedSearch || undefined
        ));
      } catch (error: any) {
        addToast(error.message || 'Failed to load inventory', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadInventory();
  }, [filterOutlet, activeTab, page, appliedSearch, addToast]);

  const outletOptions = [
    { value: '', label: 'All Outlets' },
    ...data.outlets.map((outlet) => ({ value: String(outlet.id), label: outlet.name }))
  ];

  const handleSearch = () => {
    setPage(0);
    setAppliedSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(0);
  };

  const safePage = Number.isFinite(data.page) && data.page >= 0 ? data.page : 0;
  const safeSize = Number.isFinite(data.size) && data.size > 0 ? data.size : PAGE_SIZE;
  const safeTotalElements = Number.isFinite(data.totalElements) && data.totalElements >= 0 ? data.totalElements : 0;
  const safeTotalPages = Number.isFinite(data.totalPages) && data.totalPages >= 0 ? data.totalPages : 0;
  const showingFrom = safeTotalElements === 0 ? 0 : (safePage * safeSize) + 1;
  const showingTo = safeTotalElements === 0 ? 0 : Math.min((safePage + 1) * safeSize, safeTotalElements);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
        <p>Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-light text-slate-900 tracking-tight">Inventory</h2>
          <p className="text-slate-500 mt-1 text-lg">Live stock tracking & history logs.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          <div className="relative group flex-1 xl:w-[320px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search..."
              className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-medium transition-all shadow-sm"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <CustomSelect
            value={filterOutlet}
            onChange={(value) => {
              setFilterOutlet(value);
              setPage(0);
            }}
            options={outletOptions}
            icon={<Filter size={18} />}
          />

          <button
            onClick={handleSearch}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Search size={18} />
            Search
          </button>
        </div>
      </header>

      <div className="flex p-1 bg-white/40 backdrop-blur-md rounded-2xl border border-white/20 w-fit">
        <button
          onClick={() => {
            setActiveTab('levels');
            setPage(0);
          }}
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
          onClick={() => {
            setActiveTab('history');
            setPage(0);
          }}
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

      <div className="glass-panel px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-slate-500">
          {appliedSearch ? `Search: "${appliedSearch}" • ` : ''}
          Showing {showingFrom}-{showingTo} of {safeTotalElements}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            disabled={safePage <= 0 || loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Prev
          </button>
          <div className="text-sm font-semibold text-slate-700 min-w-[88px] text-center">
            Page {safeTotalPages === 0 ? 0 : safePage + 1} / {safeTotalPages}
          </div>
          <button
            onClick={() => setPage((prev) => prev + 1)}
            disabled={loading || safePage + 1 >= safeTotalPages}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
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
                {data.inventoryLevels.length > 0 ? (
                  data.inventoryLevels.map((row) => (
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
                        <span className={`text-sm font-mono px-2 py-1 rounded-md ${row.totalOut > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-400 bg-slate-50'}`}>
                          {row.totalOut > 0 ? `-${row.totalOut}` : '0'}
                        </span>
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
                {data.historyLog.length > 0 ? (
                  data.historyLog.map((log) => (
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

import React, { useState, useMemo, useEffect } from 'react';
import { StockEntry, Product, EnrichedStockEntry, Outlet } from '../types';
import { calculateEntryMetrics } from '../utils/calculations';
import { FileDown, CalendarDays, Filter, Edit2, Check, X } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface ReportsProps {
  entries: StockEntry[];
  products: Product[];
  outlets: Outlet[];
  refreshData?: () => Promise<void>;
}

interface BatchGroup {
  batchId: string;
  entries: EnrichedStockEntry[];
  entryDate: string;
  createdAt: string;
  batchNumber: number;
  batchName?: string;
  isChecked?: boolean;
}

interface ReportDataState {
  batchesByDate: Record<string, BatchGroup[]>;
  sortedDates: string[];
}

const Reports: React.FC<ReportsProps> = ({ entries, products, outlets, refreshData }) => {
  const [filterOutlet, setFilterOutlet] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingBatchName, setEditingBatchName] = useState('');
  const [localBatchUpdates, setLocalBatchUpdates] = useState<Record<string, { batchName?: string; isChecked?: boolean }>>({});
  const { addToast } = useToast();

  const reportData = useMemo<ReportDataState>(() => {
    // Filter entries by outlet if needed
    const filteredEntries = entries.filter(e => 
      !filterOutlet || e.outletId === filterOutlet
    );

    // Group entries by batchId (proper batch identification)
    const batchMap: Record<string, EnrichedStockEntry[]> = {};
    
    filteredEntries.forEach(e => {
      const metrics = calculateEntryMetrics(e, products, outlets);
      
      // Use batchId if available, otherwise fall back to createdAt for old entries
      let batchKey: string;
      if (e.batchId) {
        batchKey = e.batchId;
      } else {
        // Fallback for old entries without batchId (legacy support)
        const timestamp = new Date(e.createdAt);
        
        // Validate the date is valid before using it
        if (isNaN(timestamp.getTime())) {
          console.warn(`Skipping entry due to invalid createdAt timestamp. Entry ID: ${e.id}, Value: ${e.createdAt}. Please verify data source.`);
          return; // Skip entries with invalid timestamps
        }
        
        timestamp.setMilliseconds(0);
        batchKey = timestamp.toISOString();
      }
      
      if (!batchMap[batchKey]) batchMap[batchKey] = [];
      batchMap[batchKey].push(metrics);
    });

    // Convert to array and sort by creation time (newest first)
    const batches: BatchGroup[] = Object.entries(batchMap)
      .map(([createdAt, entries]) => {
        const batchId = createdAt;
        const localUpdate = localBatchUpdates[batchId];
        
        return {
          batchId,
          entries,
          entryDate: entries[0]?.entryDate || '',
          createdAt,
          batchNumber: 0, // Will be assigned per date
          // Apply local updates if they exist, otherwise use data from entries
          batchName: localUpdate?.batchName !== undefined ? localUpdate.batchName : entries[0]?.batchName,
          isChecked: localUpdate?.isChecked !== undefined ? localUpdate.isChecked : (entries[0]?.isChecked || false)
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Group batches by date
    const batchesByDate: Record<string, BatchGroup[]> = {};
    batches.forEach(batch => {
      const date = batch.entryDate;
      if (!batchesByDate[date]) batchesByDate[date] = [];
      batchesByDate[date].push(batch);
    });

    // Assign batch numbers per date
    Object.values(batchesByDate).forEach(dateBatches => {
      dateBatches.forEach((batch, index) => {
        batch.batchNumber = index + 1;
      });
    });

    const sortedDates = Object.keys(batchesByDate).sort().reverse();

    return { batchesByDate, sortedDates };
  }, [entries, products, outlets, filterOutlet, localBatchUpdates]);

  useEffect(() => {
    if (reportData.sortedDates.length > 0 && !selectedDate) {
      setSelectedDate(reportData.sortedDates[0]);
    }
  }, [reportData.sortedDates, selectedDate]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const currentBatches = selectedDate ? reportData.batchesByDate[selectedDate] || [] : [];

  const handleEditBatchName = (batchId: string, currentName?: string) => {
    setEditingBatchId(batchId);
    setEditingBatchName(currentName || '');
  };

  const handleSaveBatchName = async (batchId: string) => {
    try {
      // Optimistic update
      setLocalBatchUpdates(prev => ({
        ...prev,
        [batchId]: { ...prev[batchId], batchName: editingBatchName }
      }));
      setEditingBatchId(null);
      
      await api.stockIn.updateBatch(batchId, editingBatchName);
      addToast('Batch name updated successfully', 'success');
      
      // Refresh data from backend to ensure consistency
      if (refreshData) {
        await refreshData();
        // Clear local update after backend sync
        setLocalBatchUpdates(prev => {
          const updated = { ...prev };
          delete updated[batchId];
          return updated;
        });
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setLocalBatchUpdates(prev => {
        const updated = { ...prev };
        delete updated[batchId];
        return updated;
      });
      addToast(error.message || 'Failed to update batch name', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingBatchId(null);
    setEditingBatchName('');
  };

  const handleToggleChecked = async (batchId: string, currentChecked: boolean) => {
    try {
      // Optimistic update
      setLocalBatchUpdates(prev => ({
        ...prev,
        [batchId]: { ...prev[batchId], isChecked: !currentChecked }
      }));
      
      await api.stockIn.updateBatch(batchId, undefined, !currentChecked);
      addToast('Batch status updated', 'success');
      
      // Refresh data from backend to ensure consistency
      if (refreshData) {
        await refreshData();
        // Clear local update after backend sync
        setLocalBatchUpdates(prev => {
          const updated = { ...prev };
          delete updated[batchId];
          return updated;
        });
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setLocalBatchUpdates(prev => {
        const updated = { ...prev };
        delete updated[batchId];
        return updated;
      });
      addToast(error.message || 'Failed to update batch status', 'error');
    }
  };

  const outletOptions = [
    { value: '', label: 'All Outlets' },
    ...outlets.map(o => ({ value: o.id, label: o.name }))
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-light text-slate-900 tracking-tight">Detailed Reports</h2>
          <p className="text-slate-500 mt-1 text-lg">Daily stock entry batches.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          
          <CustomSelect 
            value={filterOutlet}
            onChange={(val) => {
              setFilterOutlet(val);
              setSelectedDate(null);
            }}
            options={outletOptions}
            icon={<Filter size={18} />}
          />

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
            <span className="text-sm text-slate-400 px-4 py-2 italic">No entries found.</span>
          )}
        </div>
      </section>

      {/* Display all batches for selected date */}
      {selectedDate && currentBatches.length > 0 ? (
        <div className="space-y-8">
          {currentBatches.map((batch, batchIndex) => (
            <div key={batch.batchId} className="glass-panel rounded-[32px] overflow-hidden shadow-xl ring-1 ring-black/5">
              {/* Batch Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    {editingBatchId === batch.batchId ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingBatchName}
                          onChange={(e) => setEditingBatchName(e.target.value)}
                          className="px-3 py-1 bg-white text-slate-900 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Enter batch name..."
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveBatchName(batch.batchId)}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <h3 className="text-white text-lg font-bold">
                          {batch.batchName || `Stock Entry #${batch.batchNumber}`}
                        </h3>
                        <button
                          onClick={() => handleEditBatchName(batch.batchId, batch.batchName)}
                          className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
                          title="Edit batch name"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleChecked(batch.batchId, batch.isChecked || false)}
                          className={`p-1.5 rounded-lg transition ${
                            batch.isChecked 
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                              : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                          title={batch.isChecked ? 'Mark as unchecked' : 'Mark as checked'}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm mt-1">
                    Date: {batch.entryDate} • Submitted: {new Date(batch.createdAt).toLocaleString()} • {batch.entries.length} items
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Total Amount</div>
                  <div className="text-2xl font-bold text-white">
                    ₹{batch.entries.reduce((sum, e) => sum + e.amount, 0).toFixed(0)}
                  </div>
                </div>
              </div>

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
                    {(() => {
                      // Group entries by brand for display within this batch
                      const entriesByBrand: Record<string, EnrichedStockEntry[]> = {};
                      batch.entries.forEach(entry => {
                        const brand = entry.brand || 'Unknown';
                        if (!entriesByBrand[brand]) entriesByBrand[brand] = [];
                        entriesByBrand[brand].push(entry);
                      });

                      return (Object.entries(entriesByBrand) as [string, EnrichedStockEntry[]][]).map(([brand, entries]) => {
                        const brandTotalAmt = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
                        const brandTotalProfit = entries.reduce((sum, e) => sum + (e.profit || 0), 0);

                        return (
                          <React.Fragment key={brand}>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                              <td colSpan={8} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500">
                                {brand}
                              </td>
                            </tr>
                            {entries.map((entry, idx) => {
                              return (
                                <tr key={`${entry.id}-${idx}`} className="hover:bg-slate-50/50 border-b border-slate-100/50 group transition-colors">
                                  <td className="px-6 py-3 text-[10px] text-slate-400 font-mono border-r border-slate-100/50">{idx + 1}</td>
                                  <td className="px-6 py-3 text-sm font-semibold text-slate-700 border-r border-slate-100/50 truncate">{entry.productName}</td>
                                  <td className="px-6 py-3 text-[10px] text-center font-mono text-slate-500 border-r border-slate-100/50">{entry.mrp.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-center text-sm font-bold border-r border-slate-100/50 text-slate-900 bg-slate-50/30">{entry.quantity}</td>
                                  <td className="px-4 py-3 text-right text-sm font-medium text-indigo-600 border-r border-slate-100/50">{entry.amount.toFixed(0)}</td>
                                  <td className={`px-4 py-3 text-right text-sm font-bold border-r border-slate-100/50 ${entry.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {entry.profit.toFixed(0)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-xs text-slate-500 border-r border-slate-100/50 font-mono">{entry.marginPerBottle.toFixed(1)}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      entry.margin > 20 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                                      entry.margin > 10 ? 'bg-amber-50 border-amber-100 text-amber-700' : 
                                      'bg-rose-50 border-rose-100 text-rose-700'
                                    }`}>
                                      {entry.margin.toFixed(1)}%
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
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-[32px] p-24 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-50 text-slate-300 rounded-full mb-6">
            <CalendarDays size={40} />
          </div>
          <div>
            <h3 className="text-2xl font-light text-slate-800">No Data for Selected Date</h3>
            <p className="text-slate-500 mt-2 text-lg">Please select a date from above.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

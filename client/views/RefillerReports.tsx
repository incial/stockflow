import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, Edit2, Loader2, PackageSearch, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { RefillerBatch, RefillerBatchEntry, RefillerReportsData } from '../types';
import { formatIndianDate, formatIndianTime } from '../utils/calculations';

const emptyReportsData: RefillerReportsData = {
  selectedDate: null,
  dates: [],
  batches: []
};

const RefillerReports: React.FC = () => {
  const [data, setData] = useState<RefillerReportsData>(emptyReportsData);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [savingEntryId, setSavingEntryId] = useState<number | null>(null);
  const { addToast } = useToast();

  const loadReports = async (date?: string | null) => {
    try {
      setLoading(true);
      const response = await api.stockIn.getRefillerReports(date || undefined);
      setData(response);
      setSelectedDate(response.selectedDate ?? date ?? null);
    } catch (error: any) {
      addToast(error.message || 'Failed to load recent batches', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleDateChange = async (date: string) => {
    setEditingEntryId(null);
    await loadReports(date);
  };

  const startEdit = (entry: RefillerBatchEntry) => {
    setEditingEntryId(entry.id);
    setEditQuantity(String(entry.quantity));
    setEditAmount(String(entry.amount));
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    setEditQuantity('');
    setEditAmount('');
  };

  const saveEntry = async (entryId: number) => {
    const quantity = Number(editQuantity);
    const amount = Number(editAmount);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      addToast('Quantity must be a whole number greater than 0', 'error');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      addToast('Cost must be greater than 0', 'error');
      return;
    }

    try {
      setSavingEntryId(entryId);
      await api.stockIn.updateEntry(entryId, quantity, amount);
      addToast('Stock entry updated successfully', 'success');
      cancelEdit();
      await loadReports(selectedDate);
    } catch (error: any) {
      addToast(error.message || 'Failed to update stock entry', 'error');
    } finally {
      setSavingEntryId(null);
    }
  };

  const selectedDateSummary = data.dates.find((group) => group.date === selectedDate) ?? (
    selectedDate && data.batches.length > 0
      ? {
          date: selectedDate,
          batchCount: data.batches.length,
          itemCount: data.batches.reduce((total, batch) => total + batch.itemCount, 0)
        }
      : null
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight">Recent Batch Edits</h2>
          <p className="text-slate-500 mt-1 text-base sm:text-lg">You can edit quantity and cost in your latest five batches.</p>
        </header>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
          <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
          <p>Loading editable batches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <header>
        <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight">Recent Batch Edits</h2>
        <p className="text-slate-500 mt-1 text-base sm:text-lg">
          Edit only the quantity and cost for entries inside your latest five outlet batches.
        </p>
      </header>

      <section className="glass-panel p-4 rounded-2xl w-full space-y-4">
        <div className="flex items-center gap-2 text-slate-500">
          <CalendarDays size={20} />
          <span className="text-xs font-bold uppercase tracking-wider">Choose Report Date</span>
        </div>

        {data.dates.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {data.dates.map((group) => (
              <button
                key={group.date}
                onClick={() => handleDateChange(group.date)}
                className={`w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition-all border ${
                  selectedDate === group.date
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                    : 'text-slate-600 border-transparent hover:bg-white/50 hover:border-white/50 hover:text-slate-800'
                }`}
              >
                <div>{formatIndianDate(group.date)}</div>
                <div className={`mt-1 text-[11px] font-medium ${selectedDate === group.date ? 'text-slate-300' : 'text-slate-400'}`}>
                  {group.batchCount} batches • {group.itemCount} items
                </div>
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-slate-400 italic">No editable batches found.</span>
        )}
      </section>

      {selectedDateSummary && (
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="glass-panel rounded-2xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected Date</div>
            <div className="mt-2 text-xl sm:text-2xl font-semibold text-slate-900 break-words">{formatIndianDate(selectedDateSummary.date)}</div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Batches</div>
            <div className="mt-2 text-xl sm:text-2xl font-semibold text-slate-900">{selectedDateSummary.batchCount}</div>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Editable Items</div>
            <div className="mt-2 text-xl sm:text-2xl font-semibold text-slate-900">{selectedDateSummary.itemCount}</div>
          </div>
        </section>
      )}

      {selectedDate && data.batches.length > 0 ? (
        <div className="space-y-8">
          {data.batches.map((batch: RefillerBatch) => (
            <div key={batch.batchId} className="glass-panel rounded-[32px] overflow-hidden shadow-xl ring-1 ring-black/5">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-white text-base sm:text-lg font-bold break-words">
                    {batch.batchName || `Stock Entry #${batch.batchNumber}`}
                  </h3>
                  <p className="text-slate-300 text-xs sm:text-sm mt-2 break-words">
                    Date: {formatIndianDate(batch.entryDate)} • Submitted: {formatIndianTime(batch.createdAt)} • {batch.itemCount} items
                  </p>
                </div>
              </div>

              <div className="md:hidden p-4 space-y-3 bg-white/50">
                {batch.entries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 break-words">{entry.productName}</div>
                        <div className="text-xs text-slate-500 mt-1">{entry.brand}</div>
                      </div>
                      {editingEntryId === entry.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEntry(entry.id)}
                            disabled={savingEntryId === entry.id}
                            className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={savingEntryId === entry.id}
                            className="p-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition disabled:opacity-50"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                      <label className="block">
                        <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Quantity</div>
                        {editingEntryId === entry.id ? (
                          <input
                            type="number"
                            min="1"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                          />
                        ) : (
                          <div className="font-semibold text-slate-800">{entry.quantity}</div>
                        )}
                      </label>
                      <label className="block">
                        <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Cost</div>
                        {editingEntryId === entry.id ? (
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                          />
                        ) : (
                          <div className="font-semibold text-slate-800">{entry.amount.toFixed(2)}</div>
                        )}
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-widest font-bold">
                      <th className="px-6 py-4 border-r border-white/10">Item</th>
                      <th className="px-6 py-4 border-r border-white/10">Brand</th>
                      <th className="px-4 py-4 text-center border-r border-white/10">Quantity</th>
                      <th className="px-4 py-4 text-right border-r border-white/10">Cost</th>
                      <th className="px-4 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/50 border-b border-slate-100/50 transition-colors">
                        <td className="px-6 py-3 text-sm font-semibold text-slate-700 border-r border-slate-100/50">{entry.productName}</td>
                        <td className="px-6 py-3 text-xs text-slate-500 border-r border-slate-100/50">{entry.brand}</td>
                        <td className="px-4 py-3 text-center border-r border-slate-100/50">
                          {editingEntryId === entry.id ? (
                            <input
                              type="number"
                              min="1"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-24 mx-auto px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-center"
                            />
                          ) : (
                            <span className="text-sm font-bold text-slate-900">{entry.quantity}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right border-r border-slate-100/50">
                          {editingEntryId === entry.id ? (
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="w-32 ml-auto px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-right"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-slate-800">{entry.amount.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingEntryId === entry.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => saveEntry(entry.id)}
                                disabled={savingEntryId === entry.id}
                                className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={savingEntryId === entry.id}
                                className="p-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition disabled:opacity-50"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(entry)}
                              className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-[32px] p-10 sm:p-16 lg:p-24 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 text-slate-300 rounded-full mb-6">
            <PackageSearch size={36} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-light text-slate-800">No Editable Batches Found</h3>
            <p className="text-slate-500 mt-2 text-base sm:text-lg">
              {selectedDate ? `No editable entries found for ${formatIndianDate(selectedDate)}.` : 'Your latest five batches will appear here.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefillerReports;

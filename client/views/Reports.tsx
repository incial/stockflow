import React, { useEffect, useMemo, useState } from 'react';
import { AdminReportsData, ReportBatch, User } from '../types';
import { FileDown, CalendarDays, Filter, Edit2, Check, X, Trash2, Loader2 } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { validateText } from '../utils/validation';
import { formatDateTime } from '../utils/calculations';

interface ReportsProps {
  currentUser: User;
}

const emptyReportsData: AdminReportsData = {
  outlets: [],
  dates: []
};

const Reports: React.FC<ReportsProps> = ({ currentUser }) => {
  const [filterOutlet, setFilterOutlet] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [editingBatchName, setEditingBatchName] = useState('');
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<ReportBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminReportsData>(emptyReportsData);
  const { addToast } = useToast();

  const loadReports = async (outletId?: number) => {
    try {
      setLoading(true);
      const response = await api.admin.getReports(outletId);
      setData(response);
      setSelectedDate(previous =>
        previous && response.dates.some(group => group.date === previous)
          ? previous
          : response.dates[0]?.date ?? null
      );
    } catch (error: any) {
      addToast(error.message || 'Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(filterOutlet ? Number(filterOutlet) : undefined);
  }, [filterOutlet]);

  const currentBatches = useMemo(
    () => data.dates.find(group => group.date === selectedDate)?.batches ?? [],
    [data.dates, selectedDate]
  );

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleEditBatchName = (batchId: number, currentName?: string) => {
    setEditingBatchId(batchId);
    setEditingBatchName(currentName || '');
  };

  const handleSaveBatchName = async (batchId: number) => {
    const validation = validateText(editingBatchName.trim(), 'Batch name', 1, 100, true);
    if (!validation.isValid) {
      addToast(validation.error || 'Invalid batch name', 'error');
      return;
    }

    try {
      await api.stockIn.updateBatch(batchId, editingBatchName.trim());
      addToast('Batch name updated successfully', 'success');
      setEditingBatchId(null);
      await loadReports(filterOutlet ? Number(filterOutlet) : undefined);
    } catch (error: any) {
      addToast(error.message || 'Failed to update batch name', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingBatchId(null);
    setEditingBatchName('');
  };

  const handleToggleChecked = async (batchId: number, currentChecked: boolean) => {
    try {
      await api.stockIn.updateBatch(batchId, undefined, !currentChecked);
      addToast('Batch status updated', 'success');
      await loadReports(filterOutlet ? Number(filterOutlet) : undefined);
    } catch (error: any) {
      addToast(error.message || 'Failed to update batch status', 'error');
    }
  };

  const handleDeleteClick = (batch: ReportBatch) => {
    setBatchToDelete(batch);
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setBatchToDelete(null);
    setDeletingBatchId(null);
  };

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return;

    try {
      setDeletingBatchId(batchToDelete.batchId);
      await api.stockIn.deleteBatch(batchToDelete.batchId);
      addToast('Batch deleted successfully', 'success');
      await loadReports(filterOutlet ? Number(filterOutlet) : undefined);
      handleCancelDelete();
    } catch (error: any) {
      setDeletingBatchId(null);
      addToast(error.message || 'Failed to delete batch', 'error');
    }
  };

  const outletOptions = [
    { value: '', label: 'All Outlets' },
    ...data.outlets.map(outlet => ({ value: String(outlet.id), label: outlet.name }))
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
        <p>Loading reports...</p>
      </div>
    );
  }

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
            onClick={() => alert(`Generating Excel Export for ${selectedDate}`)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5"
          >
            <FileDown size={20} />
            Export Excel
          </button>
        </div>
      </header>

      <section className="glass-panel p-2 rounded-2xl overflow-x-auto scrollbar-hide w-full">
        <div className="flex items-center gap-2 min-w-max">
          <div className="px-4 py-2 text-slate-400 border-r border-slate-200/50 mr-2 flex items-center gap-2">
            <CalendarDays size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Date</span>
          </div>
          {data.dates.length > 0 ? (
            data.dates.map((group, idx) => (
              <button
                key={group.date}
                onClick={() => handleDateChange(group.date)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-transparent ${
                  selectedDate === group.date
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                    : 'text-slate-500 hover:bg-white/50 hover:border-white/50 hover:text-slate-800'
                }`}
              >
                {group.date}
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

      {selectedDate && currentBatches.length > 0 ? (
        <div className="space-y-8">
          {currentBatches.map((batch) => (
            <div key={batch.batchId} className="glass-panel rounded-[32px] overflow-hidden shadow-xl ring-1 ring-black/5">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    {editingBatchId === batch.batchId ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingBatchName}
                          onChange={(e) => setEditingBatchName(e.target.value)}
                          maxLength={100}
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
                        {currentUser && (
                          <button
                            onClick={() => handleDeleteClick(batch)}
                            className="p-1.5 bg-rose-600/80 text-white rounded-lg hover:bg-rose-700 transition"
                            title="Delete batch"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm mt-1">
                    Date: {batch.entryDate} • Submitted: {formatDateTime(batch.createdAt)} • {batch.itemCount} items
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Total Amount</div>
                  <div className="text-2xl font-bold text-white">₹{batch.totalAmount.toFixed(0)}</div>
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
                    {batch.entries.map((entry, idx) => (
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
                    ))}
                    <tr className="bg-slate-900 text-white font-bold text-sm">
                      <td colSpan={4} className="px-6 py-4 text-right border-r border-white/10 uppercase tracking-wider">Batch Total</td>
                      <td className="px-4 py-4 text-right border-r border-white/10">₹{batch.totalAmount.toFixed(0)}</td>
                      <td className="px-4 py-4 text-right border-r border-white/10">₹{batch.totalProfit.toFixed(0)}</td>
                      <td colSpan={2}></td>
                    </tr>
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

      {showDeleteConfirm && batchToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
                <Trash2 className="text-rose-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Batch?</h3>
                <p className="text-slate-600 mb-4">
                  Are you sure you want to delete this batch? This action cannot be undone.
                </p>
                <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-1">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-700">Batch Name: </span>
                    <span className="text-slate-600">{batchToDelete.batchName || `Stock Entry #${batchToDelete.batchNumber}`}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-slate-700">Date: </span>
                    <span className="text-slate-600">{batchToDelete.entryDate}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-slate-700">Items: </span>
                    <span className="text-slate-600">{batchToDelete.itemCount} products</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-slate-700">Total Amount: </span>
                    <span className="text-slate-600">₹{batchToDelete.totalAmount.toFixed(0)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelDelete}
                    disabled={deletingBatchId !== null}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deletingBatchId !== null}
                    className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {deletingBatchId ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      'Delete Batch'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

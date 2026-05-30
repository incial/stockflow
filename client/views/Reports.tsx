import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, Edit2, FileDown, Filter, Loader2, Trash2, X } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { AdminReportsData, ReportBatch, User } from '../types';
import { formatIndianDate, formatIndianTime } from '../utils/calculations';
import { validateText } from '../utils/validation';

interface ReportsProps {
  currentUser: User;
}

const emptyReportsData: AdminReportsData = {
  outlets: [],
  dates: [],
  selectedDate: null,
  batches: []
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const ReportsSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-11 w-32 rounded-xl bg-slate-200/70" />
        ))}
      </div>
    </div>
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="glass-panel rounded-[32px] overflow-hidden">
          <div className="h-24 bg-slate-200/70" />
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((__, rowIndex) => (
              <div key={rowIndex} className="h-12 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ReportDetailsSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    {Array.from({ length: 2 }).map((_, index) => (
      <div key={index} className="glass-panel rounded-[32px] overflow-hidden">
        <div className="h-24 bg-slate-200/70" />
        <div className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((__, rowIndex) => (
            <div key={rowIndex} className="h-12 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const escapeCsvCell = (value: string | number | null | undefined) => {
  const normalized = value == null ? '' : String(value);
  if (normalized.includes('"') || normalized.includes(',') || normalized.includes('\n')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const Reports: React.FC<ReportsProps> = ({ currentUser }) => {
  const [filterOutlet, setFilterOutlet] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [editingBatchName, setEditingBatchName] = useState('');
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<ReportBatch | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [data, setData] = useState<AdminReportsData>(emptyReportsData);
  const [calendarDate, setCalendarDate] = useState('');
  const { addToast } = useToast();

  const outletId = filterOutlet ? Number(filterOutlet) : undefined;

  const loadReportDetails = async (date: string, currentOutlets?: AdminReportsData['outlets'], currentDates?: AdminReportsData['dates']) => {
    if (!api.session.hasAdminSession()) {
      setData(emptyReportsData);
      setSelectedDate(null);
      setCalendarDate('');
      setDetailsLoading(false);
      return;
    }

    try {
      setDetailsLoading(true);
      const response = await api.admin.getReports(outletId, date);
      setData({
        outlets: response.outlets.length > 0 ? response.outlets : (currentOutlets ?? data.outlets),
        dates: response.dates.length > 0 ? response.dates : (currentDates ?? data.dates),
        selectedDate: response.selectedDate ?? date,
        batches: response.batches
      });
      setSelectedDate(response.selectedDate ?? date);
      setCalendarDate(response.selectedDate ?? date);
    } catch (error: any) {
      setData((current) => ({ ...current, batches: [] }));
      addToast(error.message || 'Failed to load report details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const loadReportSummary = async (preferredDate?: string | null) => {
    if (!api.session.hasAdminSession()) {
      setData(emptyReportsData);
      setSelectedDate(null);
      setCalendarDate('');
      setSummaryLoading(false);
      return;
    }

    try {
      setSummaryLoading(true);
      const response = await api.admin.getReports(outletId);
      const nextDate = preferredDate || response.selectedDate;

      setData({
        outlets: response.outlets,
        dates: response.dates,
        selectedDate: nextDate,
        batches: []
      });
      setSelectedDate(nextDate);
      setCalendarDate(nextDate ?? '');

      if (nextDate) {
        await loadReportDetails(nextDate, response.outlets, response.dates);
      }
    } catch (error: any) {
      setData(emptyReportsData);
      addToast(error.message || 'Failed to load reports', 'error');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadReportSummary();
  }, [filterOutlet]);

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setCalendarDate(date);
    setData((previous) => ({
      ...previous,
      selectedDate: date,
      batches: []
    }));
    await loadReportDetails(date);
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
      setEditingBatchName('');
      await loadReportSummary(selectedDate);
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
      await loadReportSummary(selectedDate);
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
    if (!batchToDelete) {
      return;
    }

    try {
      setDeletingBatchId(batchToDelete.batchId);
      await api.stockIn.deleteBatch(batchToDelete.batchId);
      addToast('Batch deleted successfully', 'success');
      handleCancelDelete();
      await loadReportSummary(selectedDate);
    } catch (error: any) {
      setDeletingBatchId(null);
      addToast(error.message || 'Failed to delete batch', 'error');
    }
  };

  const handleExportCsv = () => {
    if (!selectedDate || data.batches.length === 0) {
      addToast('No report data available to export', 'error');
      return;
    }

    const rows = [
      ['Date', 'Batch Number', 'Batch Name', 'Created At', 'Product', 'Brand', 'Outlet', 'Quantity', 'MRP', 'Amount', 'Profit', 'Margin Per Bottle', 'Margin %'],
      ...data.batches.flatMap((batch) =>
        batch.entries.map((entry) => [
          formatIndianDate(batch.entryDate),
          batch.batchNumber,
          batch.batchName || `Stock Entry #${batch.batchNumber}`,
          formatIndianTime(batch.createdAt),
          entry.productName,
          entry.brand,
          entry.outletName,
          entry.quantity,
          entry.mrp,
          entry.amount,
          entry.profit,
          entry.marginPerBottle,
          entry.margin
        ])
      )
    ];

    const csv = rows
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stockflow_report_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('CSV exported successfully', 'success');
  };

  const handleCalendarSubmit = async () => {
    if (!calendarDate) {
      addToast('Please choose a date', 'error');
      return;
    }

    await handleDateChange(calendarDate);
  };

  const outletOptions = [
    { value: '', label: 'All Outlets' },
    ...data.outlets.map((outlet) => ({ value: String(outlet.id), label: outlet.name }))
  ];

  const selectedDateSummary = data.dates.find((group) => group.date === selectedDate) ?? (
    selectedDate && data.batches.length > 0
      ? {
          date: selectedDate,
          batchCount: data.batches.length,
          itemCount: data.batches.reduce((total, batch) => total + batch.itemCount, 0),
          totalAmount: data.batches.reduce((total, batch) => total + batch.totalAmount, 0)
        }
      : null
  );

  if (summaryLoading) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
          <div>
            <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight">Detailed Reports</h2>
            <p className="text-slate-500 mt-1 text-base sm:text-lg">Daily stock entry batches.</p>
          </div>
        </header>
        <ReportsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight">Detailed Reports</h2>
          <p className="text-slate-500 mt-1 text-base sm:text-lg">Load one date at a time for faster review and export.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 w-full md:w-auto">
          <CustomSelect
            value={filterOutlet}
            onChange={(value) => {
              setFilterOutlet(value);
              setSelectedDate(null);
            }}
            options={outletOptions}
            icon={<Filter size={18} />}
          />

          <button
            onClick={handleExportCsv}
            disabled={detailsLoading || data.batches.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <FileDown size={20} />
            Export CSV
          </button>
        </div>
      </header>

      <section className="glass-panel p-4 rounded-2xl w-full space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <CalendarDays size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Choose Report Date</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <input
              type="date"
              value={calendarDate}
              onChange={(e) => setCalendarDate(e.target.value)}
              className="w-full sm:w-auto px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-medium transition-all shadow-sm"
            />
            <button
              onClick={handleCalendarSubmit}
              disabled={detailsLoading || !calendarDate}
              className="w-full sm:w-auto px-5 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Load Date
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Recent Dates</div>
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
            <span className="text-sm text-slate-400 italic">No entries found.</span>
          )}
        </div>
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
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Amount</div>
            <div className="mt-2 text-xl sm:text-2xl font-semibold text-slate-900 break-words">{currencyFormatter.format(selectedDateSummary.totalAmount)}</div>
          </div>
        </section>
      )}

      {detailsLoading ? (
        <ReportDetailsSkeleton />
      ) : selectedDate && data.batches.length > 0 ? (
        <div className="space-y-5 sm:space-y-8">
          {data.batches.map((batch) => (
            <div key={batch.batchId} className="glass-panel rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-xl ring-1 ring-black/5">
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    {editingBatchId === batch.batchId ? (
                      <div className="flex flex-wrap items-center gap-2 w-full">
                        <input
                          type="text"
                          value={editingBatchName}
                          onChange={(e) => setEditingBatchName(e.target.value)}
                          maxLength={100}
                          className="w-full sm:w-auto sm:min-w-[240px] px-3 py-2 bg-white text-slate-900 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Enter batch name..."
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveBatchName(batch.batchId)}
                          className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-white text-base sm:text-lg font-bold break-words">
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
                      </>
                    )}
                  </div>
                  <p className="text-slate-300 text-xs sm:text-sm mt-2 break-words">
                    Date: {formatIndianDate(batch.entryDate)} • Submitted: {formatIndianTime(batch.createdAt)} • {batch.itemCount} items
                  </p>
                </div>
                <div className="text-left lg:text-right">
                  <div className="text-sm text-slate-400">Batch Total</div>
                  <div className="text-xl sm:text-2xl font-bold text-white break-words">{currencyFormatter.format(batch.totalAmount)}</div>
                </div>
              </div>

              <div className="md:hidden p-4 space-y-3 bg-white/50">
                {batch.entries.map((entry, index) => (
                  <div key={`${entry.id}-${index}`} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-slate-400">#{index + 1}</div>
                        <div className="text-sm font-semibold text-slate-800 break-words">{entry.productName}</div>
                        <div className="text-xs text-slate-500 mt-1">{entry.brand}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Qty</div>
                        <div className="text-sm font-bold text-slate-900">{entry.quantity}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">MRP</div>
                        <div className="font-medium text-slate-700">{entry.mrp.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Cost</div>
                        <div className="font-medium text-indigo-600">{entry.amount.toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Profit</div>
                        <div className={entry.profit >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                          {entry.profit.toFixed(0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Per Unit</div>
                        <div className="font-medium text-slate-700">{entry.marginPerBottle.toFixed(1)}</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold border ${
                        entry.margin > 20 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                        entry.margin > 10 ? 'bg-amber-50 border-amber-100 text-amber-700' :
                        'bg-rose-50 border-rose-100 text-rose-700'
                      }`}>
                        Margin {entry.margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl bg-slate-900 text-white p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-400">Batch Total</div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                    <span>Amount</span>
                    <span className="font-bold">{currencyFormatter.format(batch.totalAmount)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                    <span>Profit</span>
                    <span className="font-bold">{currencyFormatter.format(batch.totalProfit)}</span>
                  </div>
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[860px] lg:min-w-[920px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-widest font-bold">
                      <th className="px-6 py-4 border-r border-white/10">Sl</th>
                      <th className="px-6 py-4 border-r border-white/10">Item Description</th>
                      <th className="px-6 py-4 border-r border-white/10 text-center">MRP</th>
                      <th className="px-4 py-4 text-center border-r border-white/10">Qty</th>
                      <th className="px-4 py-4 text-right border-r border-white/10">Cost</th>
                      <th className="px-4 py-4 text-right border-r border-white/10">Profit</th>
                      <th className="px-4 py-4 text-right border-r border-white/10">Per Unit</th>
                      <th className="px-4 py-4 text-center">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.entries.map((entry, index) => (
                      <tr key={`${entry.id}-${index}`} className="hover:bg-slate-50/50 border-b border-slate-100/50 transition-colors">
                        <td className="px-6 py-3 text-xs text-slate-400 font-mono border-r border-slate-100/50">{index + 1}</td>
                        <td className="px-6 py-3 border-r border-slate-100/50">
                          <div className="text-sm font-semibold text-slate-700">{entry.productName}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{entry.brand}</div>
                        </td>
                        <td className="px-6 py-3 text-xs text-center font-mono text-slate-500 border-r border-slate-100/50">
                          {entry.mrp.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-bold border-r border-slate-100/50 text-slate-900 bg-slate-50/30">
                          {entry.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-indigo-600 border-r border-slate-100/50">
                          {entry.amount.toFixed(0)}
                        </td>
                        <td className={`px-4 py-3 text-right text-sm font-bold border-r border-slate-100/50 ${entry.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {entry.profit.toFixed(0)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500 border-r border-slate-100/50 font-mono">
                          {entry.marginPerBottle.toFixed(1)}
                        </td>
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
                      <td className="px-4 py-4 text-right border-r border-white/10">{currencyFormatter.format(batch.totalAmount)}</td>
                      <td className="px-4 py-4 text-right border-r border-white/10">{currencyFormatter.format(batch.totalProfit)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-[24px] sm:rounded-[32px] p-8 sm:p-16 lg:p-24 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 text-slate-300 rounded-full mb-6">
            <CalendarDays size={40} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-light text-slate-800">No Data for Selected Date</h3>
            <p className="text-slate-500 mt-2 text-base sm:text-lg">
              {selectedDate ? `No report batches found for ${formatIndianDate(selectedDate)}.` : 'Choose a date with report batches to inspect or export.'}
            </p>
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
                    <span className="text-slate-600">{formatIndianDate(batchToDelete.entryDate)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-slate-700">Items: </span>
                    <span className="text-slate-600">{batchToDelete.itemCount} products</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-slate-700">Total Amount: </span>
                    <span className="text-slate-600">{currencyFormatter.format(batchToDelete.totalAmount)}</span>
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
                        <Loader2 className="animate-spin" size={16} />
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

import React, { useState } from 'react';
import { CalendarDays, Check, Edit2, FileDown, Filter, Trash2, X } from 'lucide-react';
import { AdminReportsData, ReportBatch } from '../types';
import { api } from '../services/api';
import { session } from '../services/session';
import { useAsyncData } from '../hooks/useAsyncData';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useToast } from '../context/ToastContext';
import { formatAmount, formatCurrency, formatIndianDate, formatIndianTime, marginTone, todayISO } from '../utils/calculations';
import { validateText } from '../utils/validation';
import { EmptyState, Loading, Modal, PageHeader, ProgressBar, Select, Spinner, StatCard } from '../components/ui';

const EMPTY: AdminReportsData = { outlets: [], dates: [], selectedDate: null, batches: [] };

const batchTitle = (batch: Pick<ReportBatch, 'batchName' | 'batchNumber'>) => batch.batchName || `Stock Entry #${batch.batchNumber}`;

const escapeCsvCell = (value: string | number | null | undefined) => {
  const normalized = value == null ? '' : String(value);
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

const downloadCsv = (data: AdminReportsData, date: string) => {
  const rows: (string | number)[][] = [
    ['Date', 'Batch Number', 'Batch Name', 'Created At', 'Product', 'Brand', 'Outlet', 'Quantity', 'MRP', 'Amount', 'Profit', 'Margin Per Bottle', 'Margin %'],
  ];
  for (const batch of data.batches) {
    for (const entry of batch.entries) {
      rows.push([
        formatIndianDate(batch.entryDate), batch.batchNumber, batchTitle(batch), formatIndianTime(batch.createdAt),
        entry.productName, entry.brand, entry.outletName, entry.quantity, entry.mrp, entry.amount,
        entry.profit, entry.marginPerBottle, entry.margin,
      ]);
    }
  }
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `stockflow_report_${date}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const Reports: React.FC = () => {
  const { addToast } = useToast();
  const isMobile = useIsMobile();
  const [filterOutlet, setFilterOutlet] = useState('');
  /** Requested date; `null` lets the server pick the most recent date. */
  const [requestedDate, setRequestedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ batchId: number; name: string } | null>(null);
  const [savingBatchId, setSavingBatchId] = useState<number | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<ReportBatch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const outletId = filterOutlet ? Number(filterOutlet) : undefined;

  const { data, initialLoading, loading, reload, setData } = useAsyncData(
    async (signal) => {
      if (!session.isAdmin()) return EMPTY;
      if (requestedDate) return api.admin.getReports(outletId, requestedDate, signal);
      // Without a date the server only returns the summary; follow up for the default date's batches.
      const summary = await api.admin.getReports(outletId, undefined, signal);
      return summary.selectedDate ? api.admin.getReports(outletId, summary.selectedDate, signal) : summary;
    },
    [outletId, requestedDate],
    EMPTY,
    'Failed to load reports'
  );

  const selectedDate = data.selectedDate;

  const updateBatch = (batchId: number, patch: Partial<ReportBatch>) =>
    setData((current) => ({
      ...current,
      batches: current.batches.map((b) => (b.batchId === batchId ? { ...b, ...patch } : b)),
    }));

  const saveBatchName = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const validation = validateText(name, 'Batch name', 1, 100, true);
    if (!validation.isValid) {
      addToast(validation.error || 'Invalid batch name', 'error');
      return;
    }
    try {
      setSavingBatchId(editing.batchId);
      await api.stockIn.updateBatch(editing.batchId, name);
      updateBatch(editing.batchId, { batchName: name });
      setEditing(null);
      addToast('Batch name updated', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to update batch name', 'error');
    } finally {
      setSavingBatchId(null);
    }
  };

  const toggleChecked = async (batch: ReportBatch) => {
    const next = !batch.isChecked;
    updateBatch(batch.batchId, { isChecked: next }); // optimistic
    try {
      await api.stockIn.updateBatch(batch.batchId, undefined, next);
    } catch (error) {
      updateBatch(batch.batchId, { isChecked: !next });
      addToast(error instanceof Error ? error.message : 'Failed to update batch status', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!batchToDelete) return;
    try {
      setDeleting(true);
      await api.stockIn.deleteBatch(batchToDelete.batchId);
      addToast('Batch deleted', 'success');
      setBatchToDelete(null);
      reload();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to delete batch', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    if (!selectedDate || data.batches.length === 0) {
      addToast('No report data available to export', 'error');
      return;
    }
    downloadCsv(data, selectedDate);
    addToast('CSV exported', 'success');
  };

  if (initialLoading) return <Loading label="Loading reports…" />;

  const outletOptions = [
    { value: '', label: 'All outlets' },
    ...data.outlets.map((outlet) => ({ value: String(outlet.id), label: outlet.name })),
  ];

  const summary = data.dates.find((d) => d.date === selectedDate) ?? (
    selectedDate && data.batches.length > 0
      ? {
          date: selectedDate,
          batchCount: data.batches.length,
          itemCount: data.batches.reduce((t, b) => t + b.itemCount, 0),
          totalAmount: data.batches.reduce((t, b) => t + b.totalAmount, 0),
        }
      : null
  );
  const totalProfit = data.batches.reduce((t, b) => t + b.totalProfit, 0);

  return (
    <div className="stack-lg page">
      <ProgressBar active={loading} />
      <PageHeader
        title="Detailed reports"
        subtitle="Stock-entry batches by date, with profit and margin per item."
        actions={
          <>
            <Select
              label="Filter by outlet"
              value={filterOutlet}
              onChange={(value) => { setFilterOutlet(value); setRequestedDate(null); }}
              options={outletOptions}
              icon={<Filter size={16} />}
            />
            <button className="btn btn-success" onClick={exportCsv} disabled={loading || data.batches.length === 0}>
              <FileDown size={16} /> Export CSV
            </button>
          </>
        }
      />

      <section className="card card-pad stack">
        <div className="row-wrap">
          <span className="row label"><CalendarDays size={16} /> Report date</span>
          <span className="spacer" />
          <input
            type="date"
            className="input"
            style={{ width: 'auto' }}
            aria-label="Choose report date"
            value={selectedDate ?? ''}
            max={todayISO()}
            onChange={(e) => e.target.value && setRequestedDate(e.target.value)}
          />
        </div>
        {data.dates.length > 0 ? (
          <div className="chips">
            {data.dates.map((group) => (
              <button
                key={group.date}
                className="chip"
                aria-pressed={selectedDate === group.date}
                onClick={() => setRequestedDate(group.date)}
              >
                <strong>{formatIndianDate(group.date)}</strong>
                <span>{group.batchCount} batches · {group.itemCount} items</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="subtle">No entries found.</span>
        )}
      </section>

      {summary && (
        <div className="stats">
          <StatCard label="Selected date" value={formatIndianDate(summary.date)} />
          <StatCard label="Batches" value={summary.batchCount} />
          <StatCard label="Total amount" value={formatCurrency(summary.totalAmount)} />
          {data.batches.length > 0 && (
            <StatCard label="Total profit" value={formatCurrency(totalProfit)} tone="success" alert={totalProfit < 0} />
          )}
        </div>
      )}

      {selectedDate && data.batches.length > 0 ? (
        data.batches.map((batch) => (
          <section key={batch.batchId} className="card">
            <div className="batch-head">
              <div style={{ minWidth: 0, flex: 1 }}>
                {editing?.batchId === batch.batchId ? (
                  <form className="row" onSubmit={(e) => { e.preventDefault(); saveBatchName(); }}>
                    <input
                      className="input"
                      value={editing.name}
                      maxLength={100}
                      autoFocus
                      aria-label="Batch name"
                      placeholder="Enter batch name…"
                      onChange={(e) => setEditing({ batchId: batch.batchId, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                    />
                    <button type="submit" className="icon-btn on" aria-label="Save name" disabled={savingBatchId === batch.batchId}>
                      {savingBatchId === batch.batchId ? <Spinner size={16} /> : <Check size={16} />}
                    </button>
                    <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => setEditing(null)}>
                      <X size={16} />
                    </button>
                  </form>
                ) : (
                  <div className="row-wrap">
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{batchTitle(batch)}</h3>
                    {batch.isChecked && <span className="badge badge-success">Checked</span>}
                    <button className="icon-btn" title="Rename batch" aria-label="Rename batch" onClick={() => setEditing({ batchId: batch.batchId, name: batch.batchName || '' })}>
                      <Edit2 size={15} />
                    </button>
                    <button
                      className={`icon-btn${batch.isChecked ? ' on' : ''}`}
                      title={batch.isChecked ? 'Mark as unchecked' : 'Mark as checked'}
                      aria-label={batch.isChecked ? 'Mark as unchecked' : 'Mark as checked'}
                      aria-pressed={Boolean(batch.isChecked)}
                      onClick={() => toggleChecked(batch)}
                    >
                      <Check size={15} />
                    </button>
                    <button className="icon-btn danger" title="Delete batch" aria-label="Delete batch" onClick={() => setBatchToDelete(batch)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
                <p className="meta">
                  {formatIndianDate(batch.entryDate)} · Submitted {formatIndianTime(batch.createdAt)} · {batch.itemCount} items
                </p>
              </div>
              <div className="total">
                <small>Batch total</small>
                <strong>{formatCurrency(batch.totalAmount)}</strong>
              </div>
            </div>

            {isMobile ? (
              <div>
                {batch.entries.map((entry, index) => (
                  <div key={`${entry.id}-${index}`} className="mobile-card">
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-title">{entry.productName}</div>
                        <div className="cell-sub">{entry.brand} · {entry.outletName}</div>
                      </div>
                      <span className={`badge badge-${marginTone(entry.margin)}`}>{entry.margin.toFixed(1)}%</span>
                    </div>
                    <dl className="kv">
                      <div><dt>Qty</dt><dd>{entry.quantity}</dd></div>
                      <div><dt>MRP</dt><dd>{formatAmount(entry.mrp)}</dd></div>
                      <div><dt>Cost</dt><dd>{formatAmount(entry.amount)}</dd></div>
                      <div><dt>Profit</dt><dd className={entry.profit >= 0 ? 'text-success' : 'text-danger'}>{formatAmount(entry.profit)}</dd></div>
                    </dl>
                  </div>
                ))}
                <div className="card-footer row" style={{ justifyContent: 'space-between' }}>
                  <span className="strong">Profit</span>
                  <span className={`num strong ${batch.totalProfit < 0 ? 'text-danger' : 'text-success'}`}>{formatCurrency(batch.totalProfit)}</span>
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="col-idx">#</th>
                      <th>Item</th>
                      <th className="text-right">MRP</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Profit</th>
                      <th className="text-right">Per unit</th>
                      <th className="text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.entries.map((entry, index) => (
                      <tr key={`${entry.id}-${index}`}>
                        <td className="col-idx">{index + 1}</td>
                        <td>
                          <div className="cell-title">{entry.productName}</div>
                          <div className="cell-sub">{entry.brand} · {entry.outletName}</div>
                        </td>
                        <td className="text-right num muted">{formatAmount(entry.mrp)}</td>
                        <td className="text-right num strong">{entry.quantity}</td>
                        <td className="text-right num">{formatAmount(entry.amount)}</td>
                        <td className={`text-right num strong ${entry.profit >= 0 ? 'text-success' : 'text-danger'}`}>{formatAmount(entry.profit)}</td>
                        <td className="text-right num muted">{entry.marginPerBottle.toFixed(2)}</td>
                        <td className="text-right"><span className={`badge badge-${marginTone(entry.margin)}`}>{entry.margin.toFixed(1)}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right">Batch total</td>
                      <td className="text-right num">{formatCurrency(batch.totalAmount)}</td>
                      <td className={`text-right num ${batch.totalProfit < 0 ? 'text-danger' : 'text-success'}`}>{formatCurrency(batch.totalProfit)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        ))
      ) : (
        <section className="card">
          <EmptyState icon={<CalendarDays size={24} />} title="No data for this date">
            {selectedDate ? `No report batches found for ${formatIndianDate(selectedDate)}.` : 'Choose a date with report batches to inspect or export.'}
          </EmptyState>
        </section>
      )}

      <Modal
        open={batchToDelete !== null}
        onClose={() => setBatchToDelete(null)}
        locked={deleting}
        title="Delete batch?"
        subtitle="This permanently removes the batch and all of its entries."
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setBatchToDelete(null)} disabled={deleting}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <><Spinner size={16} /> Deleting…</> : <><Trash2 size={16} /> Delete batch</>}
            </button>
          </>
        }
      >
        {batchToDelete && (
          <dl className="kv" style={{ marginTop: 0 }}>
            <div><dt>Batch</dt><dd>{batchTitle(batchToDelete)}</dd></div>
            <div><dt>Date</dt><dd>{formatIndianDate(batchToDelete.entryDate)}</dd></div>
            <div><dt>Items</dt><dd>{batchToDelete.itemCount} products</dd></div>
            <div><dt>Total</dt><dd>{formatCurrency(batchToDelete.totalAmount)}</dd></div>
          </dl>
        )}
      </Modal>
    </div>
  );
};

export default Reports;

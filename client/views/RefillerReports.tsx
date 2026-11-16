import React, { useState } from 'react';
import { CalendarDays, Check, Edit2, PackageSearch, X } from 'lucide-react';
import { RefillerBatchEntry, RefillerReportsData } from '../types';
import { api } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useToast } from '../context/ToastContext';
import { formatAmount, formatIndianDate, formatIndianTime } from '../utils/calculations';
import { sanitizeNumberInput, validatePositiveDecimal, validatePositiveInteger } from '../utils/validation';
import { EmptyState, Loading, PageHeader, ProgressBar, Spinner, StatCard } from '../components/ui';

const EMPTY: RefillerReportsData = { selectedDate: null, dates: [], batches: [] };

interface EditState {
  entryId: number;
  quantity: string;
  amount: string;
}

const RefillerReports: React.FC = () => {
  const { addToast } = useToast();
  const isMobile = useIsMobile();
  const [requestedDate, setRequestedDate] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, initialLoading, loading, setData } = useAsyncData(
    (signal) => api.stockIn.getRefillerReports(requestedDate || undefined, signal),
    [requestedDate],
    EMPTY,
    'Failed to load recent batches'
  );
  const selectedDate = data.selectedDate;

  const selectDate = (date: string) => {
    setEdit(null);
    setRequestedDate(date);
  };

  const startEdit = (entry: RefillerBatchEntry) =>
    setEdit({ entryId: entry.id, quantity: String(entry.quantity), amount: String(entry.amount) });

  const saveEntry = async () => {
    if (!edit) return;
    const qtyCheck = validatePositiveInteger(edit.quantity, 'Quantity');
    const amtCheck = validatePositiveDecimal(edit.amount, 'Cost');
    if (!edit.quantity || !qtyCheck.isValid) {
      addToast(qtyCheck.error || 'Quantity is required', 'error');
      return;
    }
    if (!edit.amount || !amtCheck.isValid) {
      addToast(amtCheck.error || 'Cost is required', 'error');
      return;
    }
    const quantity = Number(edit.quantity);
    const amount = Number(edit.amount);
    try {
      setSaving(true);
      await api.stockIn.updateEntry(edit.entryId, quantity, amount);
      // Patch the entry locally instead of re-fetching the whole report.
      setData((current) => ({
        ...current,
        batches: current.batches.map((batch) => ({
          ...batch,
          entries: batch.entries.map((e) => (e.id === edit.entryId ? { ...e, quantity, amount } : e)),
        })),
      }));
      setEdit(null);
      addToast('Stock entry updated', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to update stock entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) return <Loading label="Loading your batches…" />;

  const summary = data.dates.find((d) => d.date === selectedDate) ?? (
    selectedDate && data.batches.length > 0
      ? { date: selectedDate, batchCount: data.batches.length, itemCount: data.batches.reduce((t, b) => t + b.itemCount, 0) }
      : null
  );

  const editControls = (entry: RefillerBatchEntry) =>
    edit?.entryId === entry.id ? (
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-success btn-sm" onClick={saveEntry} disabled={saving} aria-label="Save changes">
          {saving ? <Spinner size={14} /> : <Check size={14} />} Save
        </button>
        <button className="icon-btn" onClick={() => setEdit(null)} disabled={saving} aria-label="Cancel editing">
          <X size={16} />
        </button>
      </div>
    ) : (
      <button className="icon-btn primary" onClick={() => startEdit(entry)} disabled={saving} aria-label={`Edit ${entry.productName}`} title="Edit">
        <Edit2 size={16} />
      </button>
    );

  const qtyField = (entry: RefillerBatchEntry) =>
    edit?.entryId === entry.id ? (
      <input
        className="input input-sm num-input"
        inputMode="numeric"
        aria-label="Quantity"
        value={edit.quantity}
        autoFocus
        onChange={(e) => setEdit({ ...edit, quantity: sanitizeNumberInput(e.target.value, false) })}
        onKeyDown={(e) => { if (e.key === 'Enter') saveEntry(); if (e.key === 'Escape') setEdit(null); }}
        style={{ maxWidth: 110, marginLeft: 'auto' }}
      />
    ) : (
      <span className="num strong">{entry.quantity}</span>
    );

  const amtField = (entry: RefillerBatchEntry) =>
    edit?.entryId === entry.id ? (
      <input
        className="input input-sm num-input"
        inputMode="decimal"
        aria-label="Cost"
        value={edit.amount}
        onChange={(e) => setEdit({ ...edit, amount: sanitizeNumberInput(e.target.value, true) })}
        onKeyDown={(e) => { if (e.key === 'Enter') saveEntry(); if (e.key === 'Escape') setEdit(null); }}
        style={{ maxWidth: 140, marginLeft: 'auto' }}
      />
    ) : (
      <span className="num">{formatAmount(entry.amount)}</span>
    );

  return (
    <div className="stack-lg page">
      <ProgressBar active={loading} />
      <PageHeader title="My recent batches" subtitle="Correct the quantity or cost of entries in your latest five outlet batches." />

      <section className="card card-pad stack">
        <span className="row label"><CalendarDays size={16} /> Batch date</span>
        {data.dates.length > 0 ? (
          <div className="chips">
            {data.dates.map((group) => (
              <button key={group.date} className="chip" aria-pressed={selectedDate === group.date} onClick={() => selectDate(group.date)}>
                <strong>{formatIndianDate(group.date)}</strong>
                <span>{group.batchCount} batches · {group.itemCount} items</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="subtle">No editable batches found.</span>
        )}
      </section>

      {summary && (
        <div className="stats">
          <StatCard label="Selected date" value={formatIndianDate(summary.date)} />
          <StatCard label="Batches" value={summary.batchCount} />
          <StatCard label="Editable items" value={summary.itemCount} />
        </div>
      )}

      {selectedDate && data.batches.length > 0 ? (
        data.batches.map((batch) => (
          <section key={batch.batchId} className="card">
            <div className="batch-head">
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{batch.batchName || `Stock Entry #${batch.batchNumber}`}</h3>
                <p className="meta">
                  {formatIndianDate(batch.entryDate)} · Submitted {formatIndianTime(batch.createdAt)} · {batch.itemCount} items
                </p>
              </div>
            </div>

            {isMobile ? (
              <div>
                {batch.entries.map((entry) => (
                  <div key={entry.id} className="mobile-card">
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-title">{entry.productName}</div>
                        <div className="cell-sub">{entry.brand}</div>
                      </div>
                      {editControls(entry)}
                    </div>
                    <div className="kv">
                      <label><span className="cell-sub">QUANTITY</span><div>{qtyField(entry)}</div></label>
                      <label><span className="cell-sub">COST</span><div>{amtField(entry)}</div></label>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Brand</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Cost (₹)</th>
                      <th className="text-right" style={{ width: 160 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="cell-title">{entry.productName}</td>
                        <td className="muted">{entry.brand}</td>
                        <td className="text-right">{qtyField(entry)}</td>
                        <td className="text-right">{amtField(entry)}</td>
                        <td className="text-right">{editControls(entry)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      ) : (
        <section className="card">
          <EmptyState icon={<PackageSearch size={24} />} title="No editable batches found">
            {selectedDate ? `No editable entries found for ${formatIndianDate(selectedDate)}.` : 'Your latest five batches will appear here.'}
          </EmptyState>
        </section>
      )}
    </div>
  );
};

export default RefillerReports;

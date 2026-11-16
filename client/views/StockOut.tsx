import React, { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Calendar, Info, Layers, PackageOpen, RefreshCw, Save, Search } from 'lucide-react';
import { Product, User } from '../types';
import { api } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../context/ToastContext';
import ConfirmationModal, { ConfirmationItem } from '../components/ConfirmationModal';
import { EmptyState, Loading, PageHeader, ProgressBar, SearchInput } from '../components/ui';
import { NumberInput, groupByBrand, matchesQuery, useUnsavedChangesWarning, validateLine } from '../components/stockForm';
import { formatAmount, formatFullDate, formatNumber, todayISO } from '../utils/calculations';
import { validateDate } from '../utils/validation';

interface StockOutProps {
  user: User;
}

interface StockOutData {
  products: Product[];
  available: Map<number, number>;
}

const EMPTY: StockOutData = { products: [], available: new Map() };

type QtyChange = (productId: number, value: string) => void;

const StockRow = memo(({ product, index, available, value, onChange }: {
  product: Product;
  index: number;
  available: number;
  value: string;
  onChange: QtyChange;
}) => {
  const { errors, empty } = validateLine({ qty: value }, { requireAmount: false, maxQty: available });
  const error = empty ? undefined : errors.qty;
  return (
    <tr className={error ? 'row-invalid' : undefined}>
      <td className="col-idx">{index + 1}</td>
      <td>
        <div className="cell-title">{product.name}</div>
        {error && <div className="field-error">{error.includes('exceed') ? `Only ${available} available` : error}</div>}
      </td>
      <td className="text-right num muted">{formatAmount(product.mrp)}</td>
      <td className="text-right"><span className="badge badge-success">{formatNumber(available)} units</span></td>
      <td className="col-num">
        <NumberInput label={`Quantity out for ${product.name}`} value={value} error={error} onChange={(v) => onChange(product.id, v)} />
      </td>
    </tr>
  );
});

const StockOut: React.FC<StockOutProps> = ({ user }) => {
  const { addToast } = useToast();
  const { data, initialLoading, loading, reload } = useAsyncData<StockOutData>(
    async (signal) => {
      const [products, available] = await Promise.all([
        api.products.getAll(),
        api.stock.getAvailability(user.outletId ?? undefined, signal),
      ]);
      return { products, available };
    },
    [user.outletId],
    EMPTY,
    'Failed to load inventory'
  );

  const [entryDate, setEntryDate] = useState(todayISO);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [formData, setFormData] = useState<Record<number, string>>({});
  const [confirmItems, setConfirmItems] = useState<ConfirmationItem[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useUnsavedChangesWarning((Object.values(formData) as string[]).some(Boolean) && !submitting);

  const inStockByBrand = useMemo(() => {
    const inStock = data.products.filter((p) => (data.available.get(p.id) ?? 0) > 0);
    return groupByBrand(inStock);
  }, [data]);

  const visibleGroups = useMemo(() => {
    if (!deferredQuery) return inStockByBrand;
    return inStockByBrand
      .map(([brand, items]) => [brand, items.filter((p) => matchesQuery(p, deferredQuery))] as [string, Product[]])
      .filter(([, items]) => items.length > 0);
  }, [inStockByBrand, deferredQuery]);

  const handleChange = useCallback<QtyChange>((productId, value) => {
    setFormData((prev) => ({ ...prev, [productId]: value }));
  }, []);

  const handleDateChange = (value: string) => {
    const validation = validateDate(value, 'Entry date', false);
    if (!validation.isValid) {
      addToast(validation.error || 'Invalid date', 'error');
      return;
    }
    setEntryDate(value);
  };

  const handleReview = () => {
    const items: ConfirmationItem[] = [];
    let invalid = 0;
    const byId = new Map(data.products.map((p) => [p.id, p]));
    for (const [id, qty] of Object.entries(formData) as [string, string][]) {
      const product = byId.get(Number(id));
      if (!product || !qty) continue;
      const available = data.available.get(product.id) ?? 0;
      if (!validateLine({ qty }, { requireAmount: false, maxQty: available }).valid) {
        invalid += 1;
        continue;
      }
      const quantity = Number(qty);
      items.push({ id: String(product.id), name: product.name, brand: product.brand, mrp: product.mrp, quantity, amount: quantity * product.mrp });
    }
    if (invalid > 0) {
      addToast(`${invalid} line${invalid === 1 ? ' has' : 's have'} an invalid quantity. Fix the highlighted rows.`, 'error');
      return;
    }
    if (items.length === 0) {
      addToast('Enter at least one quantity to remove.', 'error');
      return;
    }
    setConfirmItems(items);
  };

  const handleConfirm = async () => {
    if (!confirmItems || submitting) return;
    if (!user.outletId) {
      addToast('Your account is not assigned to an outlet.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.stockOut.addBatch({
        outletId: user.outletId,
        entryDate,
        items: confirmItems.map((item) => ({ productId: Number(item.id), quantity: item.quantity, reason: 'Sale' })),
      });
      setFormData({});
      setConfirmItems(null);
      addToast(`Recorded ${confirmItems.length} stock-out entr${confirmItems.length === 1 ? 'y' : 'ies'}.`, 'success');
      reload(); // refresh availability
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to record stock out.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (initialLoading) return <Loading label="Loading available stock…" />;

  return (
    <div className="stack-lg page">
      <ProgressBar active={loading} />
      <PageHeader
        title="Stock out"
        subtitle={<><span className="strong">{user.name}</span> · {formatFullDate()}</>}
        actions={
          <button className="btn btn-outline" onClick={reload} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh stock
          </button>
        }
      />

      <div className="action-bar">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search available inventory…" />
        <div className="input-wrap" style={{ width: 'auto' }}>
          <Calendar size={16} className="input-icon" />
          <input type="date" className="input" aria-label="Entry date" value={entryDate} max={todayISO()} onChange={(e) => handleDateChange(e.target.value)} />
        </div>
        <button className="btn btn-danger" onClick={handleReview} disabled={submitting || inStockByBrand.length === 0}>
          <Save size={16} /> Review & confirm
        </button>
      </div>

      <div className="alert alert-info">
        <Info size={16} />
        <span>Enter the quantity sold or removed. Only items with <strong>stock available</strong> at your outlet are listed.</span>
      </div>

      {visibleGroups.length > 0 ? (
        visibleGroups.map(([brand, items]) => (
          <section key={brand} className="card brand-group">
            <div className="card-header">
              <span className="row card-title"><Layers size={16} className="subtle" /> {brand}</span>
              <span className="card-sub num">{items.length} in stock</span>
            </div>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th className="col-idx">#</th>
                    <th>Item</th>
                    <th className="text-right" style={{ width: 110 }}>MRP (₹)</th>
                    <th className="text-right" style={{ width: 130 }}>Available</th>
                    <th className="text-right col-num">Qty out</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p, idx) => (
                    <StockRow
                      key={p.id}
                      product={p}
                      index={idx}
                      available={data.available.get(p.id) ?? 0}
                      value={formData[p.id] ?? ''}
                      onChange={handleChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      ) : (
        <section className="card">
          {searchQuery ? (
            <EmptyState icon={<Search size={24} />} title="No items found">No in-stock items match “{searchQuery}”.</EmptyState>
          ) : (
            <EmptyState icon={<PackageOpen size={24} />} title="No stock available">There are no items with stock to remove.</EmptyState>
          )}
        </section>
      )}

      <ConfirmationModal
        isOpen={confirmItems !== null}
        onClose={() => !submitting && setConfirmItems(null)}
        onConfirm={handleConfirm}
        isProcessing={submitting}
        items={confirmItems ?? []}
        title="Confirm stock out"
        subtitle={`Entry date ${entryDate.split('-').reverse().join('-')} · review the items you're removing`}
        confirmButtonText="Confirm removal"
        confirmButtonColor="rose"
        modalType="stockOut"
      />
    </div>
  );
};

export default StockOut;

import React, { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Calendar, Edit2, Info, Layers, PackagePlus, Plus, Save, Search, Trash2
} from 'lucide-react';
import { Product, User } from '../types';
import { api } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../context/ToastContext';
import ConfirmationModal, { ConfirmationItem } from '../components/ConfirmationModal';
import { EmptyState, Loading, Modal, PageHeader, SearchInput, Spinner } from '../components/ui';
import {
  MAX_AMOUNT, NumberInput, groupByBrand, matchesQuery, uid, useUnsavedChangesWarning, validateLine
} from '../components/stockForm';
import { formatAmount, formatFullDate, todayISO } from '../utils/calculations';
import { validateDate, validatePositiveDecimal, validateText } from '../utils/validation';

interface RefillerDashboardProps {
  user: User;
}

interface EntryValue { qty: string; amt: string }
interface NewRow { id: string; name: string; mrp: string; qty: string; amt: string }
interface CustomTable { id: string; title: string; rows: NewRow[] }

type RowField = keyof Omit<NewRow, 'id'>;
type EntryChange = (productId: number, field: keyof EntryValue, value: string) => void;
type RowChange = (rowId: string, field: RowField, value: string) => void;

const EMPTY_VALUE: EntryValue = { qty: '', amt: '' };
const newRow = (): NewRow => ({ id: uid('row'), name: '', mrp: '', qty: '', amt: '' });

const lineTotal = (qty: string, mrp: number) => (parseFloat(qty) || 0) * mrp;

/* ---------- Row components (memoised: typing in one row re-renders only that row) ---------- */

const ProductRow = memo(({ product, index, value, showBrand, onChange, onEdit, onDelete }: {
  product: Product;
  index: number;
  value: EntryValue;
  showBrand?: boolean;
  onChange: EntryChange;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) => {
  const { errors, empty } = validateLine(value, { requireAmount: true });
  const loss = !empty && parseFloat(value.amt) > lineTotal(value.qty, product.mrp) && lineTotal(value.qty, product.mrp) > 0;
  return (
    <tr className={!empty && (errors.qty || errors.amt) ? 'row-invalid' : undefined}>
      <td className="col-idx">{index + 1}</td>
      <td>
        <div className="cell-title">{product.name}</div>
        {showBrand && <div className="cell-sub">{product.brand}</div>}
        {!empty && (errors.qty || errors.amt) && <div className="field-error">{errors.qty || errors.amt}</div>}
        {loss && <div className="field-error">Cost is higher than MRP value</div>}
      </td>
      <td className="text-right num muted">{formatAmount(product.mrp)}</td>
      <td className="col-num">
        <NumberInput label={`Quantity for ${product.name}`} value={value.qty} error={errors.qty} onChange={(v) => onChange(product.id, 'qty', v)} />
      </td>
      <td className="col-num">
        <NumberInput label={`Total cost for ${product.name}`} decimals placeholder="0.00" value={value.amt} error={errors.amt} onChange={(v) => onChange(product.id, 'amt', v)} />
      </td>
      <td className="col-act">
        <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
          <button className="icon-btn primary" title="Edit product" aria-label={`Edit ${product.name}`} onClick={() => onEdit(product)}><Edit2 size={15} /></button>
          <button className="icon-btn danger" title="Delete product" aria-label={`Delete ${product.name}`} onClick={() => onDelete(product)}><Trash2 size={15} /></button>
        </div>
      </td>
    </tr>
  );
});

const NewItemRow = memo(({ row, onChange, onRemove }: { row: NewRow; onChange: RowChange; onRemove: (rowId: string) => void }) => {
  const { errors, empty } = validateLine(row, { requireAmount: true, isNewProduct: true });
  const firstError = !empty ? errors.name || errors.mrp || errors.qty || errors.amt : undefined;
  return (
    <tr className={firstError ? 'row-invalid' : 'row-new'}>
      <td className="col-idx"><Plus size={12} /></td>
      <td>
        <input
          className={`input input-sm${!empty && errors.name ? ' invalid' : ''}`}
          placeholder="New item name"
          aria-label="New item name"
          maxLength={100}
          value={row.name}
          onChange={(e) => onChange(row.id, 'name', e.target.value)}
        />
        {firstError && <div className="field-error">{firstError}</div>}
      </td>
      <td className="col-num">
        <NumberInput label="MRP" decimals placeholder="MRP" value={row.mrp} error={!empty ? errors.mrp : undefined} onChange={(v) => onChange(row.id, 'mrp', v)} />
      </td>
      <td className="col-num">
        <NumberInput label="Quantity" value={row.qty} error={!empty ? errors.qty : undefined} onChange={(v) => onChange(row.id, 'qty', v)} />
      </td>
      <td className="col-num">
        <NumberInput label="Total cost" decimals placeholder="0.00" value={row.amt} error={!empty ? errors.amt : undefined} onChange={(v) => onChange(row.id, 'amt', v)} />
      </td>
      <td className="col-act">
        <button className="icon-btn danger" aria-label="Remove row" title="Remove row" onClick={() => onRemove(row.id)}><Trash2 size={15} /></button>
      </td>
    </tr>
  );
});

const TableHead: React.FC = () => (
  <thead>
    <tr>
      <th className="col-idx">#</th>
      <th>Item</th>
      <th className="text-right" style={{ width: 110 }}>MRP (₹)</th>
      <th className="text-right col-num">Quantity</th>
      <th className="text-right col-num">Total cost (₹)</th>
      <th className="col-act" />
    </tr>
  </thead>
);

/* ---------- Main view ---------- */

const RefillerDashboard: React.FC<RefillerDashboardProps> = ({ user }) => {
  const { addToast } = useToast();
  const { data: products, initialLoading, reload: reloadProducts } = useAsyncData(
    () => api.products.getAll(),
    [],
    [] as Product[],
    'Failed to load products'
  );

  const [entryDate, setEntryDate] = useState(todayISO);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [formData, setFormData] = useState<Record<number, EntryValue>>({});
  const [newItemsByBrand, setNewItemsByBrand] = useState<Record<string, NewRow[]>>({});
  const [customTables, setCustomTables] = useState<CustomTable[]>([]);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', brand: '', mrp: '' });
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [confirmItems, setConfirmItems] = useState<ConfirmationItem[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Products already created for client rows, so a retry after a failed batch never duplicates them. */
  const createdProducts = useRef(new Map<string, number>());

  const productsByBrand = useMemo(() => groupByBrand(products), [products]);
  const searchResults = useMemo(
    () => (deferredQuery ? products.filter((p) => matchesQuery(p, deferredQuery)) : []),
    [products, deferredQuery]
  );

  const isDirty = (Object.values(formData) as EntryValue[]).some((v) => v.qty || v.amt)
    || (Object.values(newItemsByBrand) as NewRow[][]).some((rows) => rows.length > 0)
    || customTables.length > 0;
  useUnsavedChangesWarning(isDirty && !submitting);

  /* ----- handlers (stable, functional updates only) ----- */

  const handleEntryChange = useCallback<EntryChange>((productId, field, value) => {
    setFormData((prev) => ({ ...prev, [productId]: { ...(prev[productId] ?? EMPTY_VALUE), [field]: value } }));
  }, []);

  const addNewItemToBrand = useCallback((brand: string) => {
    setNewItemsByBrand((prev) => ({ ...prev, [brand]: [...(prev[brand] ?? []), newRow()] }));
  }, []);

  const updateNewItem = useCallback((brand: string, rowId: string, field: RowField, value: string) => {
    setNewItemsByBrand((prev) => ({
      ...prev,
      [brand]: (prev[brand] ?? []).map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
    }));
  }, []);

  const removeNewItem = useCallback((brand: string, rowId: string) => {
    setNewItemsByBrand((prev) => ({ ...prev, [brand]: (prev[brand] ?? []).filter((r) => r.id !== rowId) }));
  }, []);

  const addCustomTable = () => setCustomTables((prev) => [...prev, { id: uid('tbl'), title: '', rows: [newRow()] }]);
  const removeCustomTable = useCallback((tableId: string) => setCustomTables((prev) => prev.filter((t) => t.id !== tableId)), []);
  const updateTableTitle = useCallback((tableId: string, title: string) =>
    setCustomTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, title } : t))), []);
  const addRowToTable = useCallback((tableId: string) =>
    setCustomTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, rows: [...t.rows, newRow()] } : t))), []);
  const removeRowFromTable = useCallback((tableId: string, rowId: string) =>
    setCustomTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, rows: t.rows.filter((r) => r.id !== rowId) } : t))), []);
  const updateTableRow = useCallback((tableId: string, rowId: string, field: RowField, value: string) =>
    setCustomTables((prev) => prev.map((t) => (t.id === tableId
      ? { ...t, rows: t.rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)) }
      : t))), []);

  const handleDateChange = (value: string) => {
    const validation = validateDate(value, 'Entry date', false);
    if (!validation.isValid) {
      addToast(validation.error || 'Invalid date', 'error');
      return;
    }
    setEntryDate(value);
  };

  /* ----- submit ----- */

  /** Collects every filled line; returns null (and reports) if anything is incomplete. */
  const collectItems = (): { items: ConfirmationItem[]; invalid: number } => {
    const items: ConfirmationItem[] = [];
    let invalid = 0;
    const byId = new Map(products.map((p) => [p.id, p]));

    for (const [id, value] of Object.entries(formData) as [string, EntryValue][]) {
      const product = byId.get(Number(id));
      const check = validateLine(value, { requireAmount: true });
      if (check.empty || !product) continue;
      if (!check.valid) { invalid += 1; continue; }
      items.push({ id: `p:${product.id}`, name: product.name, brand: product.brand, mrp: product.mrp, quantity: Number(value.qty), amount: Number(value.amt) });
    }

    const pushNew = (brand: string, row: NewRow) => {
      const check = validateLine(row, { requireAmount: true, isNewProduct: true });
      if (check.empty) return;
      if (!check.valid || !brand.trim()) { invalid += 1; return; }
      items.push({ id: row.id, name: row.name.trim(), brand: brand.trim(), mrp: Number(row.mrp), quantity: Number(row.qty), amount: Number(row.amt) });
    };
    for (const [brand, rows] of Object.entries(newItemsByBrand) as [string, NewRow[]][]) rows.forEach((row) => pushNew(brand, row));
    for (const table of customTables) table.rows.forEach((row) => pushNew(table.title, row));

    return { items, invalid };
  };

  const handleReview = () => {
    const { items, invalid } = collectItems();
    if (invalid > 0) {
      addToast(`${invalid} line${invalid === 1 ? ' is' : 's are'} incomplete or invalid. Fix the highlighted rows (new categories need a name).`, 'error');
      return;
    }
    if (items.length === 0) {
      addToast('Enter a quantity and total cost for at least one item.', 'error');
      return;
    }
    setConfirmItems(items);
  };

  const handleConfirmSave = async () => {
    if (!confirmItems || submitting) return;
    if (!user.outletId) {
      addToast('Your account is not assigned to an outlet.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create any new products first (sequentially, remembering each one so retries are safe).
      const batchItems: { productId: number; quantity: number; amount: number }[] = [];
      for (const item of confirmItems) {
        let productId: number | undefined;
        if (item.id.startsWith('p:')) {
          productId = Number(item.id.slice(2));
        } else {
          productId = createdProducts.current.get(item.id);
          if (productId === undefined) {
            try {
              const created = await api.products.create({ name: item.name, brand: item.brand, mrp: item.mrp });
              productId = created.id;
              createdProducts.current.set(item.id, productId);
            } catch (e) {
              throw new Error(`Failed to create new product "${item.name}": ${e instanceof Error ? e.message : 'unknown error'}`);
            }
          }
        }
        batchItems.push({ productId, quantity: item.quantity, amount: item.amount });
      }

      // 2. Submit the batch. The form is only cleared once the server has accepted it.
      await api.stockIn.addBatch({ outletId: user.outletId, entryDate, items: batchItems });

      createdProducts.current.clear();
      setFormData({});
      setNewItemsByBrand({});
      setCustomTables([]);
      setConfirmItems(null);
      addToast(`Stock batch saved (${batchItems.length} item${batchItems.length === 1 ? '' : 's'}).`, 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to save stock batch.', 'error');
    } finally {
      setSubmitting(false);
      if (confirmItems.some((i) => !i.id.startsWith('p:'))) {
        reloadProducts(); // new products may now exist on the server
      }
    }
  };

  /* ----- product edit / delete ----- */

  const initiateEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    setEditForm({ name: product.name, brand: product.brand, mrp: String(product.mrp) });
  }, []);

  const submitEdit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingProduct) return;
    const checks = [
      validateText(editForm.name, 'Product name', 1, 100, true),
      validateText(editForm.brand, 'Brand name', 1, 100, true),
      editForm.mrp ? validatePositiveDecimal(editForm.mrp, 'MRP', MAX_AMOUNT) : { isValid: false, error: 'MRP is required' },
    ];
    const failed = checks.find((c) => !c.isValid);
    if (failed) {
      addToast(failed.error || 'Invalid product details', 'error');
      return;
    }
    try {
      setIsProcessing(true);
      await api.products.update(editingProduct.id, { name: editForm.name.trim(), brand: editForm.brand.trim(), mrp: parseFloat(editForm.mrp) });
      addToast('Product updated', 'success');
      setEditingProduct(null);
      reloadProducts();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to update product', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const submitDelete = async () => {
    if (!deletingProduct) return;
    try {
      setIsProcessing(true);
      await api.products.delete(deletingProduct.id);
      addToast('Product deleted', 'success');
      setFormData((prev) => {
        const next = { ...prev };
        delete next[deletingProduct.id];
        return next;
      });
      setDeletingProduct(null);
      reloadProducts();
    } catch {
      addToast('Failed to delete product: it has stock entries associated with it.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (initialLoading) return <Loading label="Loading products…" />;

  return (
    <div className="stack-lg page">
      <PageHeader title="Stock entry" subtitle={<><span className="strong">{user.name}</span> · {formatFullDate()}</>} />

      <div className="action-bar">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search products by name or brand…" />
        <div className="input-wrap" style={{ width: 'auto' }}>
          <Calendar size={16} className="input-icon" />
          <input
            type="date"
            className="input"
            aria-label="Entry date"
            value={entryDate}
            max={todayISO()}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>
        <button className="btn btn-dark" onClick={handleReview} disabled={submitting}>
          <Save size={16} /> Review & submit
        </button>
      </div>

      <div className="alert alert-info">
        <Info size={16} />
        <span>Enter the quantity and the <strong>total cost</strong> for that whole quantity. Total cost should be below quantity × MRP to make a profit.</span>
      </div>

      {deferredQuery ? (
        <section className="card">
          <div className="card-header">
            <span className="row card-title"><Search size={16} /> {searchResults.length} result{searchResults.length === 1 ? '' : 's'} for “{searchQuery.trim()}”</span>
          </div>
          {searchResults.length === 0 ? (
            <EmptyState icon={<Search size={24} />} title="No products match your search">Try a different name or brand.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 640 }}>
                <TableHead />
                <tbody>
                  {searchResults.map((p, idx) => (
                    <ProductRow key={p.id} product={p} index={idx} value={formData[p.id] ?? EMPTY_VALUE} showBrand onChange={handleEntryChange} onEdit={initiateEdit} onDelete={setDeletingProduct} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <>
          {productsByBrand.length === 0 && (
            <section className="card">
              <EmptyState icon={<Layers size={24} />} title="No products yet">Add a new category below to create your first products.</EmptyState>
            </section>
          )}
          {productsByBrand.map(([brand, brandProducts]) => (
            <BrandGroup
              key={brand}
              brand={brand}
              products={brandProducts}
              formData={formData}
              newRows={newItemsByBrand[brand]}
              onEntryChange={handleEntryChange}
              onEdit={initiateEdit}
              onDelete={setDeletingProduct}
              onAddRow={addNewItemToBrand}
              onRowChange={updateNewItem}
              onRowRemove={removeNewItem}
            />
          ))}
        </>
      )}

      <section className="stack">
        <div className="row-wrap">
          <h2 className="row card-title"><PackagePlus size={18} className="text-success" /> New categories</h2>
          <span className="spacer" />
          <button className="btn btn-outline" onClick={addCustomTable}><Plus size={16} /> Add category</button>
        </div>

        {customTables.map((table) => (
          <CustomTableCard
            key={table.id}
            table={table}
            onTitle={updateTableTitle}
            onRemove={removeCustomTable}
            onAddRow={addRowToTable}
            onRowChange={updateTableRow}
            onRowRemove={removeRowFromTable}
          />
        ))}

        {customTables.length === 0 && (
          <div className="dashed-empty">
            <EmptyState icon={<PackagePlus size={24} />} title="No new categories">
              Use “Add category” for items from a brand that isn't listed yet.
            </EmptyState>
          </div>
        )}
      </section>

      <ConfirmationModal
        isOpen={confirmItems !== null}
        onClose={() => !submitting && setConfirmItems(null)}
        onConfirm={handleConfirmSave}
        isProcessing={submitting}
        items={confirmItems ?? []}
        title="Confirm stock entry"
        subtitle={`Entry date ${entryDate.split('-').reverse().join('-')} · review the items before submitting`}
        confirmButtonText="Submit batch"
        confirmButtonColor="indigo"
        modalType="stockIn"
      />

      <Modal
        open={editingProduct !== null}
        onClose={() => setEditingProduct(null)}
        locked={isProcessing}
        title="Edit product"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditingProduct(null)} disabled={isProcessing}>Cancel</button>
            <button className="btn btn-primary" form="edit-product-form" type="submit" disabled={isProcessing}>
              {isProcessing ? <><Spinner size={16} /> Saving…</> : 'Save changes'}
            </button>
          </>
        }
      >
        <form id="edit-product-form" className="stack" onSubmit={submitEdit}>
          <div className="field">
            <label className="label" htmlFor="ep-name">Product name</label>
            <input id="ep-name" className="input" maxLength={100} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label" htmlFor="ep-brand">Brand / category</label>
            <input id="ep-brand" className="input" maxLength={100} value={editForm.brand} onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label" htmlFor="ep-mrp">MRP (₹)</label>
            <input id="ep-mrp" className="input" inputMode="decimal" value={editForm.mrp} onChange={(e) => setEditForm((f) => ({ ...f, mrp: e.target.value.replace(/[^\d.]/g, '') }))} />
          </div>
        </form>
      </Modal>

      <Modal
        open={deletingProduct !== null}
        onClose={() => setDeletingProduct(null)}
        locked={isProcessing}
        title="Delete product?"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDeletingProduct(null)} disabled={isProcessing}>Cancel</button>
            <button className="btn btn-danger" onClick={submitDelete} disabled={isProcessing}>
              {isProcessing ? <><Spinner size={16} /> Deleting…</> : 'Delete'}
            </button>
          </>
        }
      >
        <div className="alert alert-warning">
          <AlertTriangle size={16} />
          <span>Delete <strong>{deletingProduct?.name}</strong>? This cannot be undone. Products with stock history cannot be deleted.</span>
        </div>
      </Modal>
    </div>
  );
};

/* ---------- Group components ---------- */

const BrandGroup = memo(({ brand, products, formData, newRows, onEntryChange, onEdit, onDelete, onAddRow, onRowChange, onRowRemove }: {
  brand: string;
  products: Product[];
  formData: Record<number, EntryValue>;
  newRows?: NewRow[];
  onEntryChange: EntryChange;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onAddRow: (brand: string) => void;
  onRowChange: (brand: string, rowId: string, field: RowField, value: string) => void;
  onRowRemove: (brand: string, rowId: string) => void;
}) => {
  const rowChange = useCallback<RowChange>((rowId, field, value) => onRowChange(brand, rowId, field, value), [brand, onRowChange]);
  const rowRemove = useCallback((rowId: string) => onRowRemove(brand, rowId), [brand, onRowRemove]);

  let mrpTotal = 0;
  let costTotal = 0;
  for (const p of products) {
    const v = formData[p.id];
    if (v) {
      mrpTotal += lineTotal(v.qty, p.mrp);
      costTotal += parseFloat(v.amt) || 0;
    }
  }
  for (const r of newRows ?? []) {
    mrpTotal += lineTotal(r.qty, parseFloat(r.mrp) || 0);
    costTotal += parseFloat(r.amt) || 0;
  }

  return (
    <section className="card brand-group">
      <div className="card-header">
        <span className="row card-title"><Layers size={16} className="subtle" /> {brand}</span>
        <span className="card-sub num">{products.length} products</span>
      </div>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 640 }}>
          <TableHead />
          <tbody>
            {products.map((p, idx) => (
              <ProductRow key={p.id} product={p} index={idx} value={formData[p.id] ?? EMPTY_VALUE} onChange={onEntryChange} onEdit={onEdit} onDelete={onDelete} />
            ))}
            {(newRows ?? []).map((row) => (
              <NewItemRow key={row.id} row={row} onChange={rowChange} onRemove={rowRemove} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ fontWeight: 400 }}>
                <button className="add-row-btn" onClick={() => onAddRow(brand)}><Plus size={14} /> Add new item to {brand}</button>
              </td>
              <td colSpan={4} className="text-right">
                <span className="muted" style={{ fontWeight: 500 }}>MRP value </span>
                <span className="num">₹{formatAmount(mrpTotal)}</span>
                <span className="muted" style={{ fontWeight: 500, marginLeft: 16 }}>Cost </span>
                <span className={`num ${costTotal > mrpTotal ? 'text-danger' : ''}`}>₹{formatAmount(costTotal)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
});

const CustomTableCard = memo(({ table, onTitle, onRemove, onAddRow, onRowChange, onRowRemove }: {
  table: CustomTable;
  onTitle: (tableId: string, title: string) => void;
  onRemove: (tableId: string) => void;
  onAddRow: (tableId: string) => void;
  onRowChange: (tableId: string, rowId: string, field: RowField, value: string) => void;
  onRowRemove: (tableId: string, rowId: string) => void;
}) => {
  const rowChange = useCallback<RowChange>((rowId, field, value) => onRowChange(table.id, rowId, field, value), [table.id, onRowChange]);
  const rowRemove = useCallback((rowId: string) => onRowRemove(table.id, rowId), [table.id, onRowRemove]);
  const mrpTotal = table.rows.reduce((sum, r) => sum + lineTotal(r.qty, parseFloat(r.mrp) || 0), 0);
  const hasLines = table.rows.some((r) => r.name || r.qty || r.amt || r.mrp);
  const missingTitle = hasLines && !table.title.trim();

  return (
    <section className="card brand-group">
      <div className="card-header">
        <input
          className="title-input"
          style={missingTitle ? { borderBottomColor: 'var(--danger)' } : undefined}
          value={table.title}
          maxLength={100}
          placeholder="Category / brand name"
          aria-label="Category name"
          autoFocus={!table.title}
          onChange={(e) => onTitle(table.id, e.target.value)}
        />
        <button className="icon-btn danger" title="Remove category" aria-label="Remove category" onClick={() => onRemove(table.id)}><Trash2 size={16} /></button>
      </div>
      {missingTitle && <div className="field-error" style={{ padding: '6px 20px 0' }}>Category name is required</div>}
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 640 }}>
          <TableHead />
          <tbody>
            {table.rows.map((row) => <NewItemRow key={row.id} row={row} onChange={rowChange} onRemove={rowRemove} />)}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ fontWeight: 400 }}>
                <button className="add-row-btn" onClick={() => onAddRow(table.id)}><Plus size={14} /> Add item</button>
              </td>
              <td colSpan={4} className="text-right">
                <span className="muted" style={{ fontWeight: 500 }}>MRP value </span>
                <span className="num">₹{formatAmount(mrpTotal)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
});

export default RefillerDashboard;

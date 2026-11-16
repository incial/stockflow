import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Modal, Spinner, StatCard } from './ui';
import { formatAmount, formatNumber } from '../utils/calculations';

export interface ConfirmationItem {
  id: string;
  name: string;
  brand: string;
  mrp: number;
  quantity: number;
  amount: number;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: ConfirmationItem[];
  title: string;
  subtitle?: string;
  confirmButtonText?: string;
  confirmButtonColor?: 'indigo' | 'rose';
  isProcessing?: boolean;
  /** stockIn shows cost / MRP / loss checks; stockOut only shows quantities. */
  modalType?: 'stockIn' | 'stockOut';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  items,
  title,
  subtitle,
  confirmButtonText = 'Confirm',
  confirmButtonColor = 'indigo',
  isProcessing = false,
  modalType = 'stockIn',
}) => {
  const isStockIn = modalType === 'stockIn';

  const { groups, totalQuantity, totalCost, totalMrp } = useMemo(() => {
    const byBrand = new Map<string, ConfirmationItem[]>();
    let qty = 0;
    let cost = 0;
    let mrp = 0;
    for (const item of items) {
      qty += item.quantity;
      cost += item.amount;
      mrp += item.mrp * item.quantity;
      const list = byBrand.get(item.brand);
      if (list) list.push(item);
      else byBrand.set(item.brand, [item]);
    }
    return { groups: [...byBrand.entries()], totalQuantity: qty, totalCost: cost, totalMrp: mrp };
  }, [items]);

  const isLoss = isStockIn && totalCost > totalMrp;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      locked={isProcessing}
      size="lg"
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={isProcessing}>Cancel</button>
          <button
            className={`btn ${confirmButtonColor === 'rose' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? <><Spinner size={16} /> Saving…</> : <><CheckCircle size={16} /> {confirmButtonText}</>}
          </button>
        </>
      }
    >
      <div className="stack">
        {isLoss && (
          <div className="alert alert-danger" role="alert">
            <AlertTriangle size={16} />
            <div>
              <strong>Loss detected: total cost exceeds total MRP value.</strong>
              <div>Please review the amounts before submitting.</div>
            </div>
          </div>
        )}

        <div className="stats">
          <StatCard label="Items" value={items.length} />
          <StatCard label="Total quantity" value={formatNumber(totalQuantity)} />
          {isStockIn && <StatCard label="Total MRP value" value={`₹${formatAmount(totalMrp)}`} alert={isLoss} />}
          {isStockIn && <StatCard label="Total cost" value={`₹${formatAmount(totalCost)}`} alert={isLoss} />}
        </div>

        {groups.map(([brand, brandItems]) => (
          <div key={brand} className="card">
            <div className="card-header" style={{ background: 'var(--surface-2)', borderRadius: '16px 16px 0 0', padding: '10px 16px' }}>
              <span className="card-title">{brand}</span>
              <span className="card-sub num">{brandItems.length} item{brandItems.length === 1 ? '' : 's'}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">MRP</th>
                    <th className="text-right">Qty</th>
                    {isStockIn && <th className="text-right">MRP value</th>}
                    {isStockIn && <th className="text-right">Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {brandItems.map((item) => {
                    const lineLoss = isStockIn && item.amount > item.mrp * item.quantity;
                    return (
                      <tr key={item.id} className={lineLoss ? 'row-invalid' : undefined}>
                        <td className="cell-title">{item.name}</td>
                        <td className="text-right num muted">{formatAmount(item.mrp)}</td>
                        <td className="text-right num strong">{formatNumber(item.quantity)}</td>
                        {isStockIn && <td className="text-right num">{formatAmount(item.mrp * item.quantity)}</td>}
                        {isStockIn && <td className={`text-right num strong ${lineLoss ? 'text-danger' : ''}`}>{formatAmount(item.amount)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default ConfirmationModal;

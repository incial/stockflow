import React from 'react';
import { X, CheckCircle, Package } from 'lucide-react';

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
  modalType?: 'stockIn' | 'stockOut'; // Type of modal to control display
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
  modalType = 'stockIn' // Default to stockIn for backward compatibility
}) => {
  if (!isOpen) return null;

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = items.reduce((sum, item) => sum + item.amount, 0);
  const totalMrpValue = items.reduce((sum, item) => sum + (item.mrp * item.quantity), 0);
  
  // Calculate if there's a loss (only relevant for stockIn)
  const isLoss = modalType === 'stockIn' && totalCost > totalMrpValue;
  const showSummaryStats = modalType === 'stockIn'; // Only show stats for Stock In

  // Group items by brand
  const itemsByBrand = items.reduce((acc, item) => {
    if (!acc[item.brand]) {
      acc[item.brand] = [];
    }
    acc[item.brand].push(item);
    return acc;
  }, {} as Record<string, ConfirmationItem[]>);

  const colorClasses = {
    indigo: {
      gradient: 'from-indigo-500 to-violet-600',
      shadow: 'shadow-indigo-500/30',
      button: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
      icon: 'bg-indigo-100 text-indigo-600',
      badge: 'bg-indigo-100/80 text-indigo-700 border-indigo-200'
    },
    rose: {
      gradient: 'from-rose-500 to-pink-600',
      shadow: 'shadow-rose-500/30',
      button: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200',
      icon: 'bg-rose-100 text-rose-600',
      badge: 'bg-rose-100/80 text-rose-700 border-rose-200'
    }
  };

  const colors = colorClasses[confirmButtonColor];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden ring-1 ring-white/20 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className={`bg-gradient-to-br ${colors.gradient} p-3 rounded-xl text-white shadow-lg ${colors.shadow}`}>
              <CheckCircle size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{title}</h3>
              {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
            disabled={isProcessing}
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary Stats - Only show for Stock In */}
        {showSummaryStats && (
          <div className="p-6 bg-gradient-to-r from-slate-50/50 to-slate-100/30 border-b border-slate-100 shrink-0">
            {/* Loss Warning Banner */}
            {isLoss && (
              <div className="mb-4 bg-rose-50 border-2 border-rose-200 rounded-xl p-4 flex items-center gap-3">
                <div className="bg-rose-100 p-2 rounded-lg">
                  <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-rose-900 text-sm">⚠️ Loss Detected: Cost exceeds MRP value</div>
                  <div className="text-rose-700 text-xs mt-0.5">The total cost is higher than the total MRP value. Please review before submitting.</div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Items</div>
                <div className="text-2xl font-black text-slate-800">{items.length}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Quantity</div>
                <div className="text-2xl font-black text-slate-800">{totalQuantity}</div>
              </div>
              <div className={`bg-white rounded-xl p-4 shadow-sm border ${isLoss ? 'border-rose-300 bg-rose-50/30' : 'border-slate-100'}`}>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total MRP Value</div>
                <div className={`text-2xl font-black ${isLoss ? 'text-rose-600' : 'text-slate-800'}`}>₹{totalMrpValue.toFixed(2)}</div>
              </div>
              <div className={`bg-white rounded-xl p-4 shadow-sm border ${isLoss ? 'border-rose-300 bg-rose-50/30' : 'border-slate-100'}`}>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Cost</div>
                <div className={`text-2xl font-black ${isLoss ? 'text-rose-600' : 'text-slate-800'}`}>₹{totalCost.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Items List - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(Object.entries(itemsByBrand) as [string, ConfirmationItem[]][]).map(([brand, brandItems]) => {
            const brandTotalCost = brandItems.reduce((sum, item) => sum + item.amount, 0);
            const brandTotalMrp = brandItems.reduce((sum, item) => sum + (item.mrp * item.quantity), 0);
            return (
              <div key={brand} className="glass-panel rounded-[20px] overflow-hidden">
                <div className="bg-slate-900/5 px-6 py-4 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <Package size={16} className="text-slate-500" />
                    <span className="text-slate-800 font-bold tracking-wide">{brand}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm font-bold text-slate-600">
                    <span className="text-xs text-slate-500">Total MRP: <span className="text-slate-700">₹{brandTotalMrp.toFixed(2)}</span></span>
                    <span className="text-xs text-slate-500">Total Cost: <span className="text-slate-700">₹{brandTotalCost.toFixed(2)}</span></span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="px-6 py-3 w-12">#</th>
                        <th className="px-6 py-3 min-w-[180px]">Item Name</th>
                        <th className="px-6 py-3 w-28 text-center">MRP (₹)</th>
                        <th className="px-6 py-3 w-28 text-center">Quantity</th>
                        <th className="px-6 py-3 w-32 text-right">Total MRP (₹)</th>
                        <th className="px-6 py-3 w-32 text-right">Total Cost (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50/50">
                      {brandItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 text-xs text-slate-300 font-mono">{idx + 1}</td>
                          <td className="px-6 py-3 text-sm font-semibold text-slate-700">{item.name}</td>
                          <td className="px-6 py-3 text-sm text-center font-mono text-slate-500">
                            {item.mrp.toFixed(2)}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${colors.badge} border`}>
                              {item.quantity} units
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-mono text-emerald-700">
                            ₹{(item.mrp * item.quantity).toFixed(2)}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-bold text-slate-800">
                            ₹{item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 flex gap-3 justify-end border-t border-slate-200 shrink-0">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-8 py-3 rounded-xl font-bold text-white ${colors.button} shadow-lg transition-all active:translate-y-0.5 disabled:opacity-50 flex items-center gap-2`}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                {confirmButtonText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

import React, { useState, useMemo } from 'react';
import { User, StockEntry, StockOutEntry, Product } from '../types';
import {
  buildProductMap,
  buildStockAggregateMap,
  formatFullDate,
  getAvailableStockFromAggregateMap
} from '../utils/calculations';
import { Save, Calendar, PackageMinus, Info, Layers, PackageOpen, Search, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ConfirmationModal, { ConfirmationItem } from '../components/ConfirmationModal';
import { 
  validatePositiveInteger, 
  validateDate, 
  validateStockAvailability,
  sanitizeNumberInput 
} from '../utils/validation';

interface StockOutProps {
  user: User;
  products: Product[];
  stockEntries: StockEntry[];
  stockOutEntries: StockOutEntry[];
  onAddStockOut: (newStockOuts: StockOutEntry[]) => void;
}

const StockOut: React.FC<StockOutProps> = ({ 
  user, 
  products, 
  stockEntries, 
  stockOutEntries, 
  onAddStockOut 
}) => {
  const { addToast } = useToast();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Handler for date change with validation
  const handleDateChange = (newDate: string) => {
    const validation = validateDate(newDate, 'Entry date', false);
    if (!validation.isValid) {
      addToast(validation.error || 'Invalid date', 'error');
      return;
    }
    setEntryDate(newDate);
  };

  // --- Confirmation Modal State ---
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationItems, setConfirmationItems] = useState<ConfirmationItem[]>([]);

  const createTempId = () => -(Date.now() + Math.floor(Math.random() * 1000));

  const productsByBrand = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
      if (!grouped[p.brand]) grouped[p.brand] = [];
      grouped[p.brand].push(p);
    });
    return grouped;
  }, [products]);
  const productMap = useMemo(() => buildProductMap(products), [products]);

  const stockAggregateMap = useMemo(
    () => buildStockAggregateMap(stockEntries, stockOutEntries),
    [stockEntries, stockOutEntries]
  );

  const availableInventory = useMemo(() => {
    const result: { brand: string; items: Product[] }[] = [];
    const lowerQuery = searchQuery.toLowerCase().trim();

    (Object.entries(productsByBrand) as [string, Product[]][]).forEach(([brand, items]) => {
      const availableItems = items.filter(p => {
        const stock = getAvailableStockFromAggregateMap(stockAggregateMap, p.id, user.outletId!);
        if (stock <= 0) return false;
        if (lowerQuery) {
          return p.name.toLowerCase().includes(lowerQuery) || p.brand.toLowerCase().includes(lowerQuery);
        }
        return true;
      });
      if (availableItems.length > 0) {
        result.push({ brand, items: availableItems });
      }
    });

    return result;
  }, [productsByBrand, user.outletId, stockAggregateMap, searchQuery]);

  const handleInputChange = (productId: number, value: string) => {
    // Sanitize input - no decimals for quantity
    const sanitized = sanitizeNumberInput(value, false);
    
    // Validate as positive integer
    const validation = validatePositiveInteger(sanitized, 'Quantity', 99999);
    if (sanitized && !validation.isValid) {
      addToast(validation.error || 'Invalid quantity', 'error');
      return;
    }

    // Validate against available stock
    if (sanitized) {
      const available = getAvailableStockFromAggregateMap(stockAggregateMap, productId, user.outletId!);
      const product = productMap.get(productId);
      const stockValidation = validateStockAvailability(parseFloat(sanitized), available, product?.name);
      if (!stockValidation.isValid) {
        addToast(stockValidation.error || 'Insufficient stock', 'error');
        return;
      }
    }

    setFormData(prev => ({ ...prev, [productId]: sanitized }));
  };

  const handleSave = () => {
    const confirmItems: ConfirmationItem[] = [];
    let error = '';

    (Object.entries(formData) as [string, string][]).forEach(([productId, qtyStr]) => {
      const numericProductId = Number(productId);
      const qty = parseFloat(qtyStr);
      if (qty > 0) {
        const available = getAvailableStockFromAggregateMap(
          stockAggregateMap,
          numericProductId,
          user.outletId!
        );
        const product = productMap.get(numericProductId);
        if (qty > available) {
          error = `Cannot remove ${qty} of ${product?.name}. Only ${available} available.`;
          return;
        }
        if (product) {
          confirmItems.push({
            id: productId,
            name: product.name,
            brand: product.brand,
            mrp: product.mrp,
            quantity: qty,
            amount: qty * product.mrp // For stock out, amount is qty * mrp
          });
        }
      }
    });

    if (error) {
      addToast(error, "error");
      return;
    }
    if (confirmItems.length === 0) {
      addToast("Please enter at least one quantity to remove.", "error");
      return;
    }

    // Show confirmation modal
    setConfirmationItems(confirmItems);
    setShowConfirmation(true);
  };

  const handleConfirmStockOut = () => {
    const newStockOuts: StockOutEntry[] = [];

    (Object.entries(formData) as [string, string][]).forEach(([productId, qtyStr]) => {
      const numericProductId = Number(productId);
      const qty = parseFloat(qtyStr);
      if (qty > 0) {
        newStockOuts.push({
          id: createTempId(),
          outletId: user.outletId!,
          productId: numericProductId,
          quantity: qty,
          date: entryDate,
          reason: 'Sale',
          enteredBy: user.id,
          createdAt: new Date().toISOString()
        });
      }
    });

    onAddStockOut(newStockOuts);
    setFormData({}); 
    setShowConfirmation(false);
    addToast(`Successfully recorded ${newStockOuts.length} stock out entries.`, "success");
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 sm:pb-20">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmStockOut}
        items={confirmationItems}
        title="Confirm Stock Out"
        subtitle="Please review the items you're about to remove"
        confirmButtonText="Confirm Removal"
        confirmButtonColor="rose"
        modalType="stockOut"
      />

      {/* Header */}
      <header className="glass-panel p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6 sticky top-2 sm:top-4 z-20">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-3 sm:p-3.5 rounded-2xl text-white shadow-lg shadow-rose-500/30">
            <PackageMinus size={24} className="sm:w-7 sm:h-7" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-light text-slate-800 tracking-tight">Stock Out</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 mt-1">
               <span className="font-bold text-slate-700">{user.name}</span>
               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
               <span>{formatFullDate()}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full xl:max-w-lg mx-auto xl:mx-8">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors" size={20} />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search available inventory..."
              className="w-full pl-12 pr-12 py-3 sm:py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-medium transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="date"
              value={entryDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full sm:w-auto pl-12 pr-4 py-3 sm:py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-bold shadow-sm"
            />
          </div>
          
          <button 
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-5 sm:px-8 py-3 sm:py-3.5 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 font-bold shadow-xl shadow-rose-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            disabled={availableInventory.length === 0}
          >
            <Save size={20} />
            Confirm
          </button>
        </div>
      </header>

      <div className="bg-rose-50/50 backdrop-blur-sm border border-rose-100 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] flex items-start gap-3 sm:gap-4 text-rose-800 text-sm">
        <div className="p-2 bg-rose-100 rounded-full shrink-0">
            <Info size={18} />
        </div>
        <p className="mt-1 leading-relaxed">Enter the quantity of items sold or removed. Only items with <strong>positive stock available</strong> are shown below.</p>
      </div>

      <div className="space-y-6">
        {availableInventory.length > 0 ? (
          availableInventory.map(({ brand, items }) => (
            <div key={brand} className="glass-panel rounded-[24px] sm:rounded-[32px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-900/5 px-5 sm:px-8 py-4 sm:py-5 flex items-center gap-3 border-b border-white/10">
                <Layers size={18} className="text-slate-500" />
                <span className="text-slate-800 font-bold tracking-wide text-lg">{brand}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="px-4 sm:px-8 py-4 sm:py-5 w-16">#</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 min-w-[180px] sm:min-w-[200px]">Item Name</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 w-32 sm:w-40 text-center">MRP (₹)</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 w-32 sm:w-40 text-center">Available</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 w-40 sm:w-48 text-center">Qty Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/50">
                    {items.map((p, idx) => {
                      const available = getAvailableStockFromAggregateMap(
                        stockAggregateMap,
                        p.id,
                        user.outletId!
                      );
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 sm:px-8 py-4 text-xs text-slate-300 font-mono">{idx + 1}</td>
                          <td className="px-4 sm:px-8 py-4 text-sm font-semibold text-slate-700">{p.name}</td>
                          <td className="px-4 sm:px-8 py-4 text-sm text-center font-mono text-slate-500">{p.mrp.toFixed(2)}</td>
                          <td className="px-4 sm:px-8 py-4 text-center">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/80 text-emerald-700 border border-emerald-200">
                              {available} units
                            </span>
                          </td>
                          <td className="px-4 sm:px-8 py-4">
                            <input 
                              type="number"
                              placeholder="0"
                              min="0"
                              max={available}
                              step="1"
                              value={formData[p.id] || ''}
                              onChange={(e) => handleInputChange(p.id, e.target.value)}
                              className="w-full text-center py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-bold text-rose-600 transition-all"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-panel p-12 sm:p-20 text-center rounded-[24px] sm:rounded-[32px] animate-in fade-in zoom-in duration-300">
             <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-50 rounded-full mb-6 shadow-sm">
                {searchQuery ? <Search size={40} className="text-slate-300" /> : <PackageOpen size={40} className="text-slate-300" />}
             </div>
             <h3 className="text-2xl font-light text-slate-800">
               {searchQuery ? 'No Items Found' : 'Inventory Empty'}
             </h3>
             <p className="text-slate-500 mt-2 max-w-sm mx-auto text-lg">
               {searchQuery 
                 ? `We couldn't find matches for "${searchQuery}"` 
                 : 'No items available to remove.'}
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockOut;

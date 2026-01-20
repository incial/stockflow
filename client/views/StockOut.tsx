import React, { useState, useMemo } from 'react';
import { User, StockEntry, StockOutEntry, Product } from '../types';
import { getAvailableStock } from '../utils/calculations';
import { Save, Calendar, PackageMinus, Info, Layers, PackageOpen, Search, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

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

  const productsByBrand = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
      if (!grouped[p.brand]) grouped[p.brand] = [];
      grouped[p.brand].push(p);
    });
    return grouped;
  }, [products]);

  const availableInventory = useMemo(() => {
    const result: { brand: string; items: Product[] }[] = [];
    const lowerQuery = searchQuery.toLowerCase().trim();

    (Object.entries(productsByBrand) as [string, Product[]][]).forEach(([brand, items]) => {
      const availableItems = items.filter(p => {
        const stock = getAvailableStock(p.id, user.outletId!, stockEntries, stockOutEntries);
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
  }, [productsByBrand, user.outletId, stockEntries, stockOutEntries, searchQuery]);

  const handleInputChange = (productId: string, value: string) => {
    setFormData(prev => ({ ...prev, [productId]: value }));
  };

  const handleSave = () => {
    const newStockOuts: StockOutEntry[] = [];
    let error = '';

    (Object.entries(formData) as [string, string][]).forEach(([productId, qtyStr]) => {
      const qty = parseFloat(qtyStr);
      if (qty > 0) {
        const available = getAvailableStock(productId, user.outletId!, stockEntries, stockOutEntries);
        if (qty > available) {
          const product = products.find(p => p.id === productId);
          error = `Cannot remove ${qty} of ${product?.name}. Only ${available} available.`;
          return;
        }
        newStockOuts.push({
          id: `so-${Math.random().toString(36).substr(2, 9)}`,
          outletId: user.outletId!,
          productId,
          quantity: qty,
          date: entryDate,
          reason: 'Sale',
          enteredBy: user.id,
          createdAt: new Date().toISOString()
        });
      }
    });

    if (error) {
      addToast(error, "error");
      return;
    }
    if (newStockOuts.length === 0) {
      addToast("Please enter at least one quantity to remove.", "error");
      return;
    }

    onAddStockOut(newStockOuts);
    setFormData({});
    addToast(`Successfully recorded ${newStockOuts.length} stock out entries.`, "success");
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <header className="glass-panel p-6 rounded-[32px] flex flex-col xl:flex-row xl:items-center justify-between gap-6 sticky top-4 z-20">
        <div className="flex items-center gap-5">
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-3.5 rounded-2xl text-white shadow-lg shadow-rose-500/30">
            <PackageMinus size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-light text-slate-800 tracking-tight">Stock Out</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
               <span className="font-bold text-slate-700">{user.name}</span>
               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
               <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
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
              className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-medium transition-all"
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
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full sm:w-auto pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-bold shadow-sm"
            />
          </div>
          
          <button 
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-8 py-3.5 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 font-bold shadow-xl shadow-rose-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            disabled={availableInventory.length === 0}
          >
            <Save size={20} />
            Confirm
          </button>
        </div>
      </header>

      <div className="bg-rose-50/50 backdrop-blur-sm border border-rose-100 p-5 rounded-[24px] flex items-start gap-4 text-rose-800 text-sm">
        <div className="p-2 bg-rose-100 rounded-full shrink-0">
            <Info size={18} />
        </div>
        <p className="mt-1 leading-relaxed">Enter the quantity of items sold or removed. Only items with <strong>positive stock available</strong> are shown below.</p>
      </div>

      <div className="space-y-6">
        {availableInventory.length > 0 ? (
          availableInventory.map(({ brand, items }) => (
            <div key={brand} className="glass-panel rounded-[32px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-900/5 px-8 py-5 flex items-center gap-3 border-b border-white/10">
                <Layers size={18} className="text-slate-500" />
                <span className="text-slate-800 font-bold tracking-wide text-lg">{brand}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="px-8 py-5 w-16">#</th>
                      <th className="px-8 py-5 min-w-[200px]">Item Name</th>
                      <th className="px-8 py-5 w-40 text-center">MRP (₹)</th>
                      <th className="px-8 py-5 w-40 text-center">Available</th>
                      <th className="px-8 py-5 w-48 text-center">Qty Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/50">
                    {items.map((p, idx) => {
                      const available = getAvailableStock(p.id, user.outletId!, stockEntries, stockOutEntries);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-8 py-4 text-xs text-slate-300 font-mono">{idx + 1}</td>
                          <td className="px-8 py-4 text-sm font-semibold text-slate-700">{p.name}</td>
                          <td className="px-8 py-4 text-sm text-center font-mono text-slate-500">{p.mrp.toFixed(2)}</td>
                          <td className="px-8 py-4 text-center">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/80 text-emerald-700 border border-emerald-200">
                              {available} units
                            </span>
                          </td>
                          <td className="px-8 py-4">
                            <input 
                              type="number"
                              placeholder="0"
                              max={available}
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
          <div className="glass-panel p-20 text-center rounded-[32px] animate-in fade-in zoom-in duration-300">
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


import React, { useState, useMemo } from 'react';
import { User, StockEntry, StockOutEntry, Product } from '../types';
import { getAvailableStock } from '../utils/calculations';
import { Save, Calendar, PackageMinus, Info, Layers } from 'lucide-react';
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
  
  // Track quantities to remove
  const [formData, setFormData] = useState<Record<string, string>>({});

  const productsByBrand = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
      if (!grouped[p.brand]) grouped[p.brand] = [];
      grouped[p.brand].push(p);
    });
    return grouped;
  }, [products]);

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
          reason: 'Sale', // Default to Sale for now
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
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="bg-rose-500 p-3 rounded-2xl text-white">
            <PackageMinus size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Stock Out</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500">
               <span className="font-semibold text-slate-700">{user.name}</span>
               <span>•</span>
               <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full sm:w-auto pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-sm"
            />
          </div>
          
          <button 
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-bold shadow-lg shadow-rose-200 transition-all hover:translate-y-[-1px]"
          >
            <Save size={18} />
            Confirm Stock Out
          </button>
        </div>
      </header>

      <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3 text-rose-800 text-sm">
        <Info size={18} className="shrink-0 mt-0.5" />
        <p>Enter the quantity of items sold or removed. The system will validate against the current available stock.</p>
      </div>

      <div className="space-y-8">
        {(Object.entries(productsByBrand) as [string, Product[]][]).map(([brand, products]) => (
          <div key={brand} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-800 px-6 py-3 flex items-center gap-2">
              <Layers size={16} className="text-slate-400" />
              <span className="text-white font-bold tracking-wide">{brand}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-500">
                    <th className="px-6 py-3 w-16">#</th>
                    <th className="px-6 py-3 min-w-[200px]">Item Name</th>
                    <th className="px-6 py-3 w-32 text-center">MRP (₹)</th>
                    <th className="px-6 py-3 w-32 text-center">Available</th>
                    <th className="px-6 py-3 w-40 text-center">Qty Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {products.map((p, idx) => {
                    const available = getAvailableStock(p.id, user.outletId!, stockEntries, stockOutEntries);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-6 py-3 text-sm font-medium text-slate-700">{p.name}</td>
                        <td className="px-6 py-3 text-sm text-center font-mono text-slate-500">{p.mrp.toFixed(2)}</td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${
                            available <= 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {available}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <input 
                            type="number"
                            placeholder="0"
                            max={available}
                            value={formData[p.id] || ''}
                            onChange={(e) => handleInputChange(p.id, e.target.value)}
                            disabled={available <= 0}
                            className={`w-full text-center py-2 bg-white border rounded-lg focus:ring-2 outline-none text-sm font-bold transition-all ${
                              available <= 0 
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                                : 'border-slate-200 focus:ring-rose-500 focus:border-rose-500 text-rose-600'
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockOut;

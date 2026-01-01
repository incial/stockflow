
import React, { useState, useMemo } from 'react';
import { User, StockEntry, Product } from '../types';
import { Save, Calendar, Store, Info, Plus, Trash2, PackagePlus, Layers } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface RefillerDashboardProps {
  user: User;
  entries: StockEntry[];
  products: Product[];
  onAddBatch: (newEntries: StockEntry[], newProducts: Product[]) => void;
}

interface CustomRow {
  id: string;
  name: string;
  mrp: string;
  qty: string;
  amt: string;
}

interface CustomTable {
  id: string;
  title: string;
  rows: CustomRow[];
}

const RefillerDashboard: React.FC<RefillerDashboardProps> = ({ user, products, onAddBatch }) => {
  const { addToast } = useToast();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [formData, setFormData] = useState<Record<string, { qty: string, amt: string }>>({});
  const [customTables, setCustomTables] = useState<CustomTable[]>([]);

  const productsByBrand = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
      if (!grouped[p.brand]) grouped[p.brand] = [];
      grouped[p.brand].push(p);
    });
    return grouped;
  }, [products]);

  const handleInputChange = (productId: string, field: 'qty' | 'amt', value: string) => {
    setFormData(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { qty: '', amt: '' }),
        [field]: value
      }
    }));
  };

  const calculateBrandTotal = (brandProducts: Product[]) => {
    return brandProducts.reduce((sum, p) => sum + (parseFloat(formData[p.id]?.amt) || 0), 0);
  };

  // --- Handlers for Custom Tables ---
  const addCustomTable = () => {
    const newTable: CustomTable = {
      id: `tbl-${Date.now()}`,
      title: 'New Category',
      rows: []
    };
    setCustomTables([...customTables, newTable]);
    addToast("New category table added. You can now add items.", "info");
  };

  const removeCustomTable = (tableId: string) => {
    setCustomTables(customTables.filter(t => t.id !== tableId));
    addToast("Category table removed.", "info");
  };

  const updateTableTitle = (tableId: string, title: string) => {
    setCustomTables(customTables.map(t => t.id === tableId ? { ...t, title } : t));
  };

  const addRowToTable = (tableId: string) => {
    setCustomTables(customTables.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          rows: [...t.rows, { id: `row-${Date.now()}`, name: '', mrp: '', qty: '', amt: '' }]
        };
      }
      return t;
    }));
  };

  const removeRowFromTable = (tableId: string, rowId: string) => {
    setCustomTables(customTables.map(t => {
      if (t.id === tableId) {
        return { ...t, rows: t.rows.filter(r => r.id !== rowId) };
      }
      return t;
    }));
  };

  const updateRowData = (tableId: string, rowId: string, field: keyof CustomRow, value: string) => {
    setCustomTables(customTables.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          rows: t.rows.map(r => r.id === rowId ? { ...r, [field]: value } : r)
        };
      }
      return t;
    }));
  };

  const calculateCustomTableTotal = (rows: CustomRow[]) => {
    return rows.reduce((sum, r) => sum + (parseFloat(r.amt) || 0), 0);
  };

  // --- SAVE ---
  const handleSave = () => {
    const newEntries: StockEntry[] = [];
    const newProducts: Product[] = [];

    // 1. Process Standard Entries
    (Object.entries(formData) as [string, { qty: string, amt: string }][]).forEach(([productId, data]) => {
      if (data.qty && data.amt) {
        newEntries.push({
          id: `s-${Math.random().toString(36).substr(2, 9)}`,
          outletId: user.outletId!,
          productId,
          quantity: parseFloat(data.qty),
          amount: parseFloat(data.amt),
          entryDate,
          enteredBy: user.id,
          createdAt: new Date().toISOString()
        });
      }
    });

    // 2. Process Custom Tables
    customTables.forEach(table => {
      table.rows.forEach(row => {
        if (row.name && row.qty && row.amt) {
          const newProductId = `p-custom-${Math.random().toString(36).substr(2, 9)}`;
          newProducts.push({
            id: newProductId,
            name: row.name,
            brand: table.title || 'Uncategorized',
            mrp: parseFloat(row.mrp) || 0
          });
          newEntries.push({
            id: `s-${Math.random().toString(36).substr(2, 9)}`,
            outletId: user.outletId!,
            productId: newProductId,
            quantity: parseFloat(row.qty),
            amount: parseFloat(row.amt),
            entryDate,
            enteredBy: user.id,
            createdAt: new Date().toISOString()
          });
        }
      });
    });

    if (newEntries.length === 0) {
      addToast("Please enter at least one valid stock entry before submitting.", "error");
      return;
    }

    onAddBatch(newEntries, newProducts);
    setFormData({});
    setCustomTables([]);
    addToast(`Success! Saved ${newEntries.length} entries including ${newProducts.length} new products.`, "success");
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <header className="glass-panel p-6 rounded-[32px] flex flex-col xl:flex-row xl:items-center justify-between gap-6 sticky top-4 z-20">
        <div className="flex items-center gap-5">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-3.5 rounded-2xl text-white shadow-lg shadow-indigo-500/30">
            <Store size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-light text-slate-800 tracking-tight">Stock Entry</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
               <span className="font-bold text-slate-700">{user.name}</span>
               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
               <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input 
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full sm:w-auto pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold shadow-inner transition-all"
            />
          </div>
          
          <button 
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl hover:bg-black font-bold shadow-xl shadow-slate-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Save size={20} />
            Submit Batch
          </button>
        </div>
      </header>

      <div className="bg-indigo-50/50 backdrop-blur-sm border border-indigo-100 p-5 rounded-[24px] flex items-start gap-4 text-indigo-800 text-sm">
        <div className="p-2 bg-indigo-100 rounded-full shrink-0">
            <Info size={18} />
        </div>
        <p className="mt-1 leading-relaxed">Enter quantity and cost amount for daily stock. Use <strong>"Add Category"</strong> below to create new product groups and add items that are not in the standard list.</p>
      </div>

      {/* Standard Product Tables */}
      <div className="space-y-8">
        {(Object.entries(productsByBrand) as [string, Product[]][]).map(([brand, products]) => (
          <div key={brand} className="glass-panel rounded-[32px] overflow-hidden">
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
                    <th className="px-8 py-5 w-40 text-center">Stock</th>
                    <th className="px-8 py-5 w-48 text-center">Cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50">
                  {products.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-8 py-4 text-xs text-slate-300 font-mono">{idx + 1}</td>
                      <td className="px-8 py-4 text-sm font-semibold text-slate-700">{p.name}</td>
                      <td className="px-8 py-4 text-sm text-center font-mono text-slate-500">{p.mrp.toFixed(2)}</td>
                      <td className="px-8 py-4">
                        <input 
                          type="number"
                          placeholder="0"
                          value={formData[p.id]?.qty || ''}
                          onChange={(e) => handleInputChange(p.id, 'qty', e.target.value)}
                          className="w-full text-center py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold transition-all"
                        />
                      </td>
                      <td className="px-8 py-4">
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={formData[p.id]?.amt || ''}
                          onChange={(e) => handleInputChange(p.id, 'amt', e.target.value)}
                          className="w-full text-center py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold text-indigo-600 transition-all focus:bg-white"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gradient-to-r from-amber-50/50 to-orange-50/50">
                    <td colSpan={4} className="px-8 py-4 text-sm font-bold text-slate-600 text-right uppercase tracking-wider text-[11px]">Total for {brand}</td>
                    <td className="px-8 py-4 text-center text-sm font-black text-slate-800">
                      ₹{calculateBrandTotal(products).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Tables Section */}
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-700 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                <PackagePlus size={20} />
            </div>
            Additional Categories
          </h3>
          <button 
            onClick={addCustomTable}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/50 backdrop-blur-sm border border-slate-200 text-slate-600 rounded-xl hover:border-indigo-500 hover:text-indigo-600 font-bold transition-all hover:bg-indigo-50/50 shadow-sm"
          >
            <Plus size={18} />
            Add New Category
          </button>
        </div>

        {customTables.map((table) => (
          <div key={table.id} className="glass-panel rounded-[32px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-50/50 px-8 py-5 flex items-center justify-between border-b border-slate-200">
              <input 
                type="text"
                value={table.title}
                onChange={(e) => updateTableTitle(table.id, e.target.value)}
                placeholder="Enter Category Name"
                className="bg-transparent text-lg font-bold text-slate-800 placeholder-slate-400 outline-none focus:underline decoration-indigo-500 decoration-2 underline-offset-4 w-full"
              />
              <button 
                onClick={() => removeCustomTable(table.id)}
                className="text-slate-400 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-xl transition-all"
                title="Remove Table"
              >
                <Trash2 size={20} />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 tracking-wider">
                    <th className="px-8 py-5 w-16">#</th>
                    <th className="px-8 py-5 min-w-[200px]">Item Name</th>
                    <th className="px-8 py-5 w-40 text-center">MRP (₹)</th>
                    <th className="px-8 py-5 w-40 text-center">Stock</th>
                    <th className="px-8 py-5 w-48 text-center">Cost (₹)</th>
                    <th className="px-8 py-5 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50">
                  {table.rows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="px-8 py-3 text-xs text-slate-300 font-mono">{idx + 1}</td>
                      <td className="px-8 py-3">
                        <input 
                          type="text"
                          placeholder="Item Name"
                          value={row.name}
                          onChange={(e) => updateRowData(table.id, row.id, 'name', e.target.value)}
                          className="w-full py-2 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-sm font-semibold text-slate-700 placeholder-slate-300"
                        />
                      </td>
                      <td className="px-8 py-3">
                        <input 
                          type="number"
                          placeholder="0"
                          value={row.mrp}
                          onChange={(e) => updateRowData(table.id, row.id, 'mrp', e.target.value)}
                          className="w-full text-center py-2 bg-slate-50 rounded-xl outline-none text-sm font-mono text-slate-600 focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </td>
                      <td className="px-8 py-3">
                        <input 
                          type="number"
                          placeholder="0"
                          value={row.qty}
                          onChange={(e) => updateRowData(table.id, row.id, 'qty', e.target.value)}
                          className="w-full text-center py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold focus:border-indigo-500 transition-all"
                        />
                      </td>
                      <td className="px-8 py-3">
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={row.amt}
                          onChange={(e) => updateRowData(table.id, row.id, 'amt', e.target.value)}
                          className="w-full text-center py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold text-indigo-600 focus:border-indigo-500 transition-all"
                        />
                      </td>
                      <td className="px-8 py-3 text-center">
                        <button 
                          onClick={() => removeRowFromTable(table.id, row.id)}
                          className="text-slate-300 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  <tr>
                    <td colSpan={2} className="px-8 py-5">
                      <button 
                        onClick={() => addRowToTable(table.id)}
                        className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
                      >
                        <Plus size={14} />
                        Add Item
                      </button>
                    </td>
                    <td colSpan={2} className="px-8 py-5 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Subtotal
                    </td>
                    <td className="px-8 py-5 text-center text-sm font-black text-slate-800">
                      ₹{calculateCustomTableTotal(table.rows).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {customTables.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-slate-200/50 rounded-[32px] bg-slate-50/30 backdrop-blur-sm">
             <div className="bg-white p-4 rounded-full inline-block shadow-sm mb-4">
                <PackagePlus size={32} className="text-slate-300" />
             </div>
             <p className="text-slate-500 font-medium text-lg">No custom categories added.</p>
             <p className="text-sm text-slate-400 mt-1">Click "Add New Category" to insert items not in the list.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RefillerDashboard;

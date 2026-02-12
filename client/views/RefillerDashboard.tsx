import React, { useState, useMemo } from 'react';
import { User, StockEntry, Product } from '../types';
import { Save, Calendar, Store, Info, Plus, Trash2, PackagePlus, Layers, Edit2, AlertTriangle, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import ConfirmationModal, { ConfirmationItem } from '../components/ConfirmationModal';
import { formatFullDate } from '../utils/calculations';
import { 
  validatePositiveInteger, 
  validatePositiveDecimal, 
  validateText,
  validateDate,
  sanitizeNumberInput 
} from '../utils/validation';

interface RefillerDashboardProps {
  user: User;
  entries: StockEntry[];
  products: Product[];
  onAddBatch: (newEntries: StockEntry[], newProducts: Product[]) => void;
  onRefresh: () => Promise<void>;
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

const RefillerDashboard: React.FC<RefillerDashboardProps> = ({ user, products, onAddBatch, onRefresh }) => {
  const { addToast } = useToast();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [formData, setFormData] = useState<Record<string, { qty: string, amt: string }>>({});
  
  // State for completely new categories
  const [customTables, setCustomTables] = useState<CustomTable[]>([]);

  // Handler for date change with validation
  const handleDateChange = (newDate: string) => {
    const validation = validateDate(newDate, 'Entry date', false);
    if (!validation.isValid) {
      addToast(validation.error || 'Invalid date', 'error');
      return;
    }
    setEntryDate(newDate);
  };
  
  // State for new items added to EXISTING brands
  const [newItemsByBrand, setNewItemsByBrand] = useState<Record<string, CustomRow[]>>({});

  // --- Product Management State ---
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', brand: '', mrp: '' });

  // --- Confirmation Modal State ---
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationItems, setConfirmationItems] = useState<ConfirmationItem[]>([]);

  const productsByBrand = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
      if (!grouped[p.brand]) grouped[p.brand] = [];
      grouped[p.brand].push(p);
    });
    return grouped;
  }, [products]);

  const handleInputChange = (productId: string, field: 'qty' | 'amt', value: string) => {
    // Sanitize input based on field type
    const sanitized = field === 'qty' 
      ? sanitizeNumberInput(value, false)  // No decimals for quantity
      : sanitizeNumberInput(value, true);   // Allow decimals for amount
    
    // Validate and show immediate feedback
    if (field === 'qty') {
      const validation = validatePositiveInteger(sanitized, 'Quantity', 99999);
      if (sanitized && !validation.isValid) {
        addToast(validation.error || 'Invalid quantity', 'error');
        return;
      }
    } else {
      const validation = validatePositiveDecimal(sanitized, 'Amount', 9999999.99);
      if (sanitized && !validation.isValid) {
        addToast(validation.error || 'Invalid amount', 'error');
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { qty: '', amt: '' }),
        [field]: sanitized
      }
    }));
  };

  // --- Handlers for New Items in Existing Brands ---
  const handleAddNewItemToBrand = (brand: string) => {
    setNewItemsByBrand(prev => ({
      ...prev,
      [brand]: [...(prev[brand] || []), { id: `new-${Date.now()}`, name: '', mrp: '', qty: '', amt: '' }]
    }));
  };

  const handleUpdateNewItem = (brand: string, rowId: string, field: keyof CustomRow, value: string) => {
    // Validate based on field type
    if (field === 'name') {
      const validation = validateText(value, 'Product name', 1, 100, false);
      if (value && !validation.isValid) {
        addToast(validation.error || 'Invalid product name', 'error');
        return;
      }
    } else if (field === 'qty') {
      const sanitized = sanitizeNumberInput(value, false);
      const validation = validatePositiveInteger(sanitized, 'Quantity', 99999);
      if (sanitized && !validation.isValid) {
        addToast(validation.error || 'Invalid quantity', 'error');
        return;
      }
      value = sanitized;
    } else if (field === 'amt' || field === 'mrp') {
      const sanitized = sanitizeNumberInput(value, true);
      const validation = validatePositiveDecimal(sanitized, field === 'mrp' ? 'MRP' : 'Amount', 9999999.99);
      if (sanitized && !validation.isValid) {
        addToast(validation.error || `Invalid ${field}`, 'error');
        return;
      }
      value = sanitized;
    }

    setNewItemsByBrand(prev => ({
      ...prev,
      [brand]: (prev[brand] || []).map(r => r.id === rowId ? { ...r, [field]: value } : r)
    }));
  };

  const handleRemoveNewItem = (brand: string, rowId: string) => {
    setNewItemsByBrand(prev => ({
      ...prev,
      [brand]: (prev[brand] || []).filter(r => r.id !== rowId)
    }));
  };

  const calculateBrandTotal = (brandProducts: Product[], brand: string) => {
    // 1. Total from existing products
    const existingTotal = brandProducts.reduce((sum, p) => {
      const qty = parseFloat(formData[p.id]?.qty) || 0;
      return sum + (qty * p.mrp);
    }, 0);

    // 2. Total from new items added to this brand
    const newItemsTotal = (newItemsByBrand[brand] || []).reduce((sum, r) => {
      const qty = parseFloat(r.qty) || 0;
      const mrp = parseFloat(r.mrp) || 0;
      return sum + (qty * mrp);
    }, 0);

    return existingTotal + newItemsTotal;
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
    const validation = validateText(title, 'Category name', 1, 100, false);
    if (title && !validation.isValid) {
      addToast(validation.error || 'Invalid category name', 'error');
      return;
    }
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
    // Validate based on field type
    if (field === 'name') {
      const validation = validateText(value, 'Product name', 1, 100, false);
      if (value && !validation.isValid) {
        addToast(validation.error || 'Invalid product name', 'error');
        return;
      }
    } else if (field === 'qty') {
      const sanitized = sanitizeNumberInput(value, false);
      const validation = validatePositiveInteger(sanitized, 'Quantity', 99999);
      if (sanitized && !validation.isValid) {
        addToast(validation.error || 'Invalid quantity', 'error');
        return;
      }
      value = sanitized;
    } else if (field === 'amt' || field === 'mrp') {
      const sanitized = sanitizeNumberInput(value, true);
      const validation = validatePositiveDecimal(sanitized, field === 'mrp' ? 'MRP' : 'Amount', 9999999.99);
      if (sanitized && !validation.isValid) {
        addToast(validation.error || `Invalid ${field}`, 'error');
        return;
      }
      value = sanitized;
    }

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
    return rows.reduce((sum, r) => {
      const qty = parseFloat(r.qty) || 0;
      const mrp = parseFloat(r.mrp) || 0;
      return sum + (qty * mrp);
    }, 0);
  };

  // --- SAVE ---
  const handleSave = () => {
    const confirmItems: ConfirmationItem[] = [];

    // 1. Process Standard Entries (Existing Products)
    (Object.entries(formData) as [string, { qty: string, amt: string }][]).forEach(([productId, data]) => {
      if (data.qty && data.amt) {
        const product = products.find(p => p.id === productId);
        if (product) {
          confirmItems.push({
            id: productId,
            name: product.name,
            brand: product.brand,
            mrp: product.mrp,
            quantity: parseFloat(data.qty),
            amount: parseFloat(data.amt)
          });
        }
      }
    });

    // 2. Process New Items in EXISTING Brands
    (Object.entries(newItemsByBrand) as [string, CustomRow[]][]).forEach(([brand, rows]) => {
      rows.forEach(row => {
        if (row.name && row.qty && row.amt) {
          confirmItems.push({
            id: row.id,
            name: row.name,
            brand: brand,
            mrp: parseFloat(row.mrp) || 0,
            quantity: parseFloat(row.qty),
            amount: parseFloat(row.amt)
          });
        }
      });
    });

    // 3. Process Custom Tables (New Categories + New Products)
    customTables.forEach(table => {
      table.rows.forEach(row => {
        if (row.name && row.qty && row.amt) {
          confirmItems.push({
            id: row.id,
            name: row.name,
            brand: table.title || 'Uncategorized',
            mrp: parseFloat(row.mrp) || 0,
            quantity: parseFloat(row.qty),
            amount: parseFloat(row.amt)
          });
        }
      });
    });

    if (confirmItems.length === 0) {
      addToast("Please enter at least one valid stock entry before submitting.", "error");
      return;
    }

    // Show confirmation modal
    setConfirmationItems(confirmItems);
    setShowConfirmation(true);
  };

  const handleConfirmSave = () => {
    const newEntries: StockEntry[] = [];
    const newProducts: Product[] = [];

    // 1. Process Standard Entries (Existing Products)
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

    // 2. Process New Items in EXISTING Brands
    (Object.entries(newItemsByBrand) as [string, CustomRow[]][]).forEach(([brand, rows]) => {
      rows.forEach(row => {
        if (row.name && row.qty && row.amt) {
          const newProductId = `p-new-${Math.random().toString(36).substr(2, 9)}`;
          newProducts.push({
            id: newProductId,
            name: row.name,
            brand: brand,
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

    // 3. Process Custom Tables (New Categories + New Products)
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

    onAddBatch(newEntries, newProducts);
    setFormData({});
    setCustomTables([]);
    setNewItemsByBrand({});
    setShowConfirmation(false);
    addToast(`Success! Processing ${newEntries.length} entries...`, "success");
  };

  // --- EDIT / DELETE LOGIC ---
  const initiateEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      brand: product.brand,
      mrp: product.mrp.toString()
    });
  };

  const submitEdit = async () => {
    if (!editingProduct) return;
    
    // Validate inputs
    const nameValidation = validateText(editForm.name, 'Product name', 1, 100, true);
    if (!nameValidation.isValid) {
      addToast(nameValidation.error || 'Invalid product name', 'error');
      return;
    }

    const brandValidation = validateText(editForm.brand, 'Brand name', 1, 100, true);
    if (!brandValidation.isValid) {
      addToast(brandValidation.error || 'Invalid brand name', 'error');
      return;
    }

    const mrpValidation = validatePositiveDecimal(editForm.mrp, 'MRP', 9999999.99);
    if (!mrpValidation.isValid) {
      addToast(mrpValidation.error || 'Invalid MRP', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      await api.products.update(editingProduct.id, {
        name: editForm.name,
        brand: editForm.brand,
        mrp: parseFloat(editForm.mrp)
      });
      addToast('Product updated successfully', 'success');
      await onRefresh();
      setEditingProduct(null);
    } catch (error: any) {
      addToast(error.message || 'Failed to update product', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const submitDelete = async () => {
    if (!deletingProduct) return;
    try {
      setIsProcessing(true);
      await api.products.delete(deletingProduct.id);
      addToast('Product deleted successfully', 'success');
      await onRefresh();
      setDeletingProduct(null);
    } catch (error: any) {
      addToast('Failed to delete product : This product has entries associated with it.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 relative">
      
      {/* --- Modals --- */}
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmSave}
        items={confirmationItems}
        title="Confirm Stock Entry"
        subtitle="Please review the items you're about to submit"
        confirmButtonText="Submit Batch"
        confirmButtonColor="indigo"
        modalType="stockIn"
      />

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-white/20">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <h3 className="text-xl font-bold text-slate-800">Edit Product</h3>
               <button onClick={() => setEditingProduct(null)} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                 <X size={20} />
               </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Product Name</label>
                <input 
                  type="text" 
                  value={editForm.name} 
                  onChange={e => setEditForm(prev => ({...prev, name: e.target.value}))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Brand / Category</label>
                <input 
                  type="text" 
                  value={editForm.brand} 
                  onChange={e => setEditForm(prev => ({...prev, brand: e.target.value}))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">MRP (₹)</label>
                <input 
                  type="number" 
                  value={editForm.mrp} 
                  onChange={e => setEditForm(prev => ({...prev, mrp: e.target.value}))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3 justify-end">
              <button 
                onClick={() => setEditingProduct(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={submitEdit}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden ring-1 ring-white/20">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Product?</h3>
              <p className="text-slate-500 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-800">{deletingProduct.name}</span>? 
                This action cannot be undone.
              </p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setDeletingProduct(null)}
                className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={submitDelete}
                disabled={isProcessing}
                className="flex-1 px-5 py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all active:translate-y-0.5 disabled:opacity-50"
              >
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}


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
               <span>{formatFullDate()}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input 
              type="date"
              value={entryDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => handleDateChange(e.target.value)}
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
        <p className="mt-1 leading-relaxed">Enter quantity and <strong>total cost</strong> for the entire stock quantity. Total cost should be less than (Quantity × MRP) to ensure profit.</p>
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
                    <th className="px-8 py-5 w-48 text-center">Total Cost (₹)</th>
                    <th className="px-8 py-5 w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50">
                  {/* Existing Products */}
                  {products.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-4 text-xs text-slate-300 font-mono">{idx + 1}</td>
                      <td className="px-8 py-4 text-sm font-semibold text-slate-700">{p.name}</td>
                      <td className="px-8 py-4 text-sm text-center font-mono text-slate-500">{p.mrp.toFixed(2)}</td>
                      <td className="px-8 py-4">
                        <input 
                          type="number"
                          placeholder="0"
                          min="0"
                          max="99999"
                          step="1"
                          value={formData[p.id]?.qty || ''}
                          onChange={(e) => handleInputChange(p.id, 'qty', e.target.value)}
                          className="w-full text-center py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold transition-all"
                        />
                      </td>
                      <td className="px-8 py-4">
                        <input 
                          type="number"
                          placeholder="0.00"
                          min="0"
                          max="9999999.99"
                          step="0.01"
                          value={formData[p.id]?.amt || ''}
                          onChange={(e) => handleInputChange(p.id, 'amt', e.target.value)}
                          className="w-full text-center py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold text-indigo-600 transition-all focus:bg-white"
                        />
                      </td>
                      <td className="px-8 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => initiateEdit(p)}
                                className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Product"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button 
                                onClick={() => setDeletingProduct(p)}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Product"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  
                  {/* New Items Rows for this Brand */}
                  {(newItemsByBrand[brand] || []).map((row, idx) => (
                    <tr key={row.id} className="bg-indigo-50/30 hover:bg-indigo-50/60 transition-colors">
                      <td className="px-8 py-4 text-xs text-indigo-300 font-mono">+</td>
                      <td className="px-8 py-4">
                        <input 
                          type="text"
                          placeholder="New Item Name"
                          value={row.name}
                          onChange={(e) => handleUpdateNewItem(brand, row.id, 'name', e.target.value)}
                          className="w-full bg-transparent border-b border-indigo-200 focus:border-indigo-500 outline-none text-sm font-semibold text-indigo-900 placeholder-indigo-300 py-1"
                          autoFocus
                        />
                      </td>
                      <td className="px-8 py-4">
                        <input 
                          type="number"
                          placeholder="MRP"
                          value={row.mrp}
                          onChange={(e) => handleUpdateNewItem(brand, row.id, 'mrp', e.target.value)}
                          className="w-full text-center bg-transparent border-b border-indigo-200 focus:border-indigo-500 outline-none text-sm font-mono text-indigo-900 placeholder-indigo-300 py-1"
                        />
                      </td>
                      <td className="px-8 py-4">
                        <input 
                          type="number"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) => handleUpdateNewItem(brand, row.id, 'qty', e.target.value)}
                          className="w-full text-center py-2.5 bg-white border border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold transition-all"
                        />
                      </td>
                      <td className="px-8 py-4">
                        <input 
                          type="number"
                          placeholder="Total Cost"
                          value={row.amt}
                          onChange={(e) => handleUpdateNewItem(brand, row.id, 'amt', e.target.value)}
                          className="w-full text-center py-2.5 bg-white border border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold text-indigo-600 transition-all"
                        />
                      </td>
                      <td className="px-8 py-4 text-center">
                        <button 
                           onClick={() => handleRemoveNewItem(brand, row.id)}
                           className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                           <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Add New Item Button Row */}
                  <tr>
                     <td colSpan={6} className="px-8 py-2">
                        <button 
                           onClick={() => handleAddNewItemToBrand(brand)}
                           className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors w-fit"
                        >
                           <Plus size={14} /> Add New Item to {brand}
                        </button>
                     </td>
                  </tr>

                  {/* Total Row */}
                  <tr className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 border-t border-amber-100/50">
                    <td colSpan={4} className="px-8 py-4 text-sm font-bold text-slate-600 text-right uppercase tracking-wider text-[11px]">Total MRP Value for {brand}</td>
                    <td className="px-8 py-4 text-center text-sm font-black text-slate-800">
                      ₹{calculateBrandTotal(products, brand).toFixed(2)}
                    </td>
                    <td></td>
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
                    <th className="px-8 py-5 w-48 text-center">Total Cost (₹)</th>
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
                          placeholder="Total Cost"
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
                      Total MRP Value
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

import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole, StockEntry, StockOutEntry, Product } from './types';
import Login from './views/Login';
import AdminDashboard from './views/AdminDashboard';
import RefillerDashboard from './views/RefillerDashboard';
import StockOut from './views/StockOut';
import Reports from './views/Reports';
import InventoryReport from './views/InventoryReport';
import MainLayout from './components/MainLayout';
import { ToastProvider, useToast } from './context/ToastContext';
import { api } from './services/api';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [stockOuts, setStockOuts] = useState<StockOutEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);
  const { addToast } = useToast();

  // 1. Initial Session Check
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('sm_user');
    
    if (token && savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else {
      setIsGlobalLoading(false);
    }
  }, []);

  // 2. Data Fetching Logic
  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    
    setIsGlobalLoading(true);
    try {
      // Determine what data to fetch based on role
      const fetchPromises = [
        api.products.getAll(),
        api.stockIn.getAll(currentUser.role === UserRole.REFILLER ? currentUser.outletId : undefined),
        api.stockOut.getAll(currentUser.role === UserRole.REFILLER ? currentUser.outletId : undefined)
      ];

      const [fetchedProducts, fetchedEntries, fetchedStockOuts] = await Promise.all(fetchPromises);
      
      setProducts(fetchedProducts as Product[]);
      setEntries(fetchedEntries as StockEntry[]);
      setStockOuts(fetchedStockOuts as StockOutEntry[]);
    } catch (error) {
      console.error("Failed to load data", error);
      addToast("Failed to connect to server. Ensure backend is running.", "error");
    } finally {
      setIsGlobalLoading(false);
    }
  }, [currentUser, addToast]);

  // Trigger fetch when user is set
  useEffect(() => {
    if (currentUser) {
      refreshData();
    }
  }, [currentUser, refreshData]);

  const handleLogin = (user: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('sm_user', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('sm_user');
    setCurrentUser(null);
    setEntries([]);
    setStockOuts([]);
  };

  const handleBatchSubmit = async (newEntries: StockEntry[], newProducts: Product[]) => {
    try {
      setIsGlobalLoading(true);
      
      // 1. If there are new products (from custom tables), create them first
      if (newProducts.length > 0) {
        for (const p of newProducts) {
           await api.products.create(p);
        }
      }

      // 2. Prepare payload for backend
      if (newEntries.length === 0) return;
      
      const payload = {
        outletId: currentUser?.outletId || newEntries[0].outletId,
        entryDate: newEntries[0].entryDate,
        items: newEntries.map(e => ({
          productId: e.productId,
          quantity: e.quantity,
          amount: e.amount
        }))
      };

      await api.stockIn.addBatch(payload);
      addToast("Stock successfully synced with server.", "success");
      await refreshData(); // Re-fetch to get server-generated IDs and consistency
      
    } catch (error) {
       console.error(error);
       addToast("Failed to save stock batch.", "error");
       setIsGlobalLoading(false);
    }
  };

  const handleStockOutSubmit = async (newStockOuts: StockOutEntry[]) => {
    try {
      setIsGlobalLoading(true);
      if (newStockOuts.length === 0) return;

      const payload = {
         outletId: currentUser?.outletId || newStockOuts[0].outletId,
         entryDate: newStockOuts[0].date,
         items: newStockOuts.map(e => ({
           productId: e.productId,
           quantity: e.quantity,
           reason: e.reason
         }))
      };

      await api.stockOut.addBatch(payload);
      addToast("Stock out recorded successfully.", "success");
      await refreshData();
    } catch (error) {
      console.error(error);
      addToast("Failed to record stock out.", "error");
      setIsGlobalLoading(false);
    }
  };

  if (isGlobalLoading && !currentUser) {
     return (
       <div className="h-screen w-full flex items-center justify-center bg-slate-50">
          <Loader2 className="animate-spin text-indigo-600" size={48} />
       </div>
     );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <MainLayout user={currentUser} onLogout={handleLogout}>
        {isGlobalLoading && (
           <div className="fixed inset-0 z-[100] bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white p-4 rounded-full shadow-2xl">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
              </div>
           </div>
        )}
        <Routes>
          {currentUser.role === UserRole.ADMIN ? (
            <>
              <Route path="/" element={<AdminDashboard entries={entries} products={products} />} />
              <Route path="/inventory" element={<InventoryReport entries={entries} stockOuts={stockOuts} products={products} />} />
              <Route path="/reports" element={<Reports entries={entries} products={products} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route 
                path="/" 
                element={
                  <RefillerDashboard 
                    user={currentUser} 
                    entries={entries} 
                    products={products}
                    onAddBatch={handleBatchSubmit} 
                  />
                } 
              />
              <Route 
                path="/stock-out" 
                element={
                  <StockOut
                    user={currentUser}
                    products={products}
                    stockEntries={entries}
                    stockOutEntries={stockOuts}
                    onAddStockOut={handleStockOutSubmit}
                  />
                } 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </MainLayout>
    </HashRouter>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;

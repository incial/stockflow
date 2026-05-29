
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { User, UserRole, StockEntry, StockOutEntry, Product } from './types';
import Login from './views/Login';
import AdminDashboard from './views/AdminDashboard';
import RefillerDashboard from './views/RefillerDashboard';
import StockOut from './views/StockOut';
import Reports from './views/Reports';
import InventoryReport from './views/InventoryReport';
import AuditLogs from './views/AuditLogs';
import MainLayout from './components/MainLayout';
import { ToastProvider, useToast } from './context/ToastContext';
import { api } from './services/api';
import { Loader2 } from 'lucide-react';

const AppRoutes: React.FC<{
  currentUser: User;
  isGlobalLoading: boolean;
  entries: StockEntry[];
  stockOuts: StockOutEntry[];
  products: Product[];
  onLogout: () => void;
  onAddBatch: (newEntries: StockEntry[], newProducts: Product[]) => Promise<void>;
  onAddStockOut: (newStockOuts: StockOutEntry[]) => Promise<void>;
  onRefresh: () => Promise<void>;
}> = ({
  currentUser,
  isGlobalLoading,
  entries,
  stockOuts,
  products,
  onLogout,
  onAddBatch,
  onAddStockOut,
  onRefresh
}) => {
  const location = useLocation();

  useEffect(() => {
    onRefresh();
  }, [location.pathname, onRefresh]);

  return (
    <MainLayout user={currentUser} onLogout={onLogout}>
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
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/inventory" element={<InventoryReport />} />
            <Route path="/reports" element={<Reports currentUser={currentUser} />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
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
                  onAddBatch={onAddBatch}
                  onRefresh={onRefresh}
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
                  onAddStockOut={onAddStockOut}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </MainLayout>
  );
};

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [stockOuts, setStockOuts] = useState<StockOutEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);
  const { addToast } = useToast();
  const refreshRequestIdRef = useRef(0);
  const inFlightRefreshKeyRef = useRef<string | null>(null);

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

    const hashPath = window.location.hash.replace(/^#/, '') || '/';
    const refreshKey = `${currentUser.id}:${currentUser.role}:${currentUser.outletId ?? 'none'}:${hashPath}`;
    if (inFlightRefreshKeyRef.current === refreshKey) {
      return;
    }

    const requestId = ++refreshRequestIdRef.current;
    inFlightRefreshKeyRef.current = refreshKey;
    setIsGlobalLoading(true);
    try {
      if (currentUser.role === UserRole.ADMIN) {
        if (requestId === refreshRequestIdRef.current) {
          setProducts([]);
          setEntries([]);
          setStockOuts([]);
        }
        return;
      }

      const outletFilter = currentUser.outletId || undefined;
      const needsStockOutHistory = hashPath === '/stock-out';
      const [fetchedProducts, fetchedEntries, fetchedStockOuts] = await Promise.all([
        api.products.getAll(),
        api.stockIn.getAll(outletFilter),
        needsStockOutHistory ? api.stockOut.getAll(outletFilter) : Promise.resolve<StockOutEntry[]>([]),
      ]);

      if (requestId === refreshRequestIdRef.current) {
        setProducts(fetchedProducts);
        setEntries(fetchedEntries);
        setStockOuts(fetchedStockOuts);
      }
    } catch (error: any) {
      if (requestId === refreshRequestIdRef.current) {
        console.error("Failed to load data", error);
        addToast(error.message || "Failed to connect to server.", "error");
      }
    } finally {
      if (inFlightRefreshKeyRef.current === refreshKey) {
        inFlightRefreshKeyRef.current = null;
      }
      if (requestId === refreshRequestIdRef.current) {
        setIsGlobalLoading(false);
      }
    }
  }, [currentUser, addToast]);

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
    setProducts([]);
  };

  const handleBatchSubmit = async (newEntries: StockEntry[], newProducts: Product[] = []) => {
    try {
      setIsGlobalLoading(true);
      
      if (newEntries.length === 0) {
        setIsGlobalLoading(false);
        return;
      }

      // 1. Process New Products Creation First
      const productIdMap: Record<number, number> = {}; // Maps tempId -> realId

      if (newProducts.length > 0) {
        // Create new products sequentially (or parallel) to get real IDs
        await Promise.all(newProducts.map(async (p) => {
          try {
            const createdProduct = await api.products.create({
              name: p.name,
              brand: p.brand,
              mrp: p.mrp
            });
            productIdMap[p.id] = createdProduct.id;
          } catch (e: any) {
            console.error(`Failed to create product ${p.name}`, e);
            throw new Error(`Failed to create new product: ${p.name}`);
          }
        }));
      }

      // 2. Update entries with real Product IDs
      const finalEntries = newEntries.map(entry => {
        const realId = productIdMap[entry.productId] || entry.productId;
        return { ...entry, productId: realId };
      });
      
      // 3. Prepare payload for backend
      const payload = {
        outletId: currentUser?.outletId || finalEntries[0].outletId,
        entryDate: finalEntries[0].entryDate,
        items: finalEntries.map(e => ({
          productId: e.productId,
          quantity: e.quantity,
          amount: e.amount
        }))
      };

      await api.stockIn.addBatch(payload);
      addToast("Stock successfully synced with server.", "success");
      await refreshData(); // Re-fetch to get server-generated IDs and consistency
      
    } catch (error: any) {
       console.error(error);
       addToast(error.message || "Failed to save stock batch.", "error");
    } finally {
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
    } catch (error: any) {
      console.error(error);
      addToast(error.message || "Failed to record stock out.", "error");
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
      <AppRoutes
        currentUser={currentUser}
        isGlobalLoading={isGlobalLoading}
        entries={entries}
        stockOuts={stockOuts}
        products={products}
        onLogout={handleLogout}
        onAddBatch={handleBatchSubmit}
        onAddStockOut={handleStockOutSubmit}
        onRefresh={refreshData}
      />
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

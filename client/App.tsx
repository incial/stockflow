
import React, { useState, useMemo, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole, StockEntry, StockOutEntry, Product } from './types';
import { MOCK_USERS, INITIAL_STOCK_ENTRIES, MOCK_PRODUCTS } from './constants';
import Login from './views/Login';
import AdminDashboard from './views/AdminDashboard';
import RefillerDashboard from './views/RefillerDashboard';
import StockOut from './views/StockOut';
import Reports from './views/Reports';
import InventoryReport from './views/InventoryReport';
import MainLayout from './components/MainLayout';
import { ToastProvider } from './context/ToastContext';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<StockEntry[]>(INITIAL_STOCK_ENTRIES);
  const [stockOuts, setStockOuts] = useState<StockOutEntry[]>([]);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);

  // Persistence mock
  useEffect(() => {
    const savedUser = localStorage.getItem('sm_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('sm_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sm_user');
  };

  const handleBatchSubmit = (newEntries: StockEntry[], newProducts: Product[]) => {
    if (newProducts.length > 0) {
      setProducts(prev => [...prev, ...newProducts]);
    }
    setEntries(prev => [...newEntries, ...prev]);
  };

  const handleStockOutSubmit = (newStockOuts: StockOutEntry[]) => {
    setStockOuts(prev => [...prev, ...newStockOuts]);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ToastProvider>
      <HashRouter>
        <MainLayout user={currentUser} onLogout={handleLogout}>
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
    </ToastProvider>
  );
};

export default App;

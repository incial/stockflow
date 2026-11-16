import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { User, UserRole } from './types';
import MainLayout from './components/MainLayout';
import { Loading } from './components/ui';
import { ToastProvider, useToast } from './context/ToastContext';
import { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE, session } from './services/session';
import { api } from './services/api';
// Login is bundled with the entry chunk (it is small) so the sign-in screen paints
// without waiting on an extra network round trip.
import Login from './views/Login';

// Each screen is its own chunk: the login page never downloads charts or admin code,
// and a refiller never downloads admin screens.
const AdminDashboard = lazy(() => import('./views/AdminDashboard'));
const InventoryReport = lazy(() => import('./views/InventoryReport'));
const Reports = lazy(() => import('./views/Reports'));
const AuditLogs = lazy(() => import('./views/AuditLogs'));
const RefillerDashboard = lazy(() => import('./views/RefillerDashboard'));
const StockOut = lazy(() => import('./views/StockOut'));
const RefillerReports = lazy(() => import('./views/RefillerReports'));

const AdminRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<AdminDashboard />} />
    <Route path="/inventory" element={<InventoryReport />} />
    <Route path="/reports" element={<Reports />} />
    <Route path="/audit-logs" element={<AuditLogs />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const RefillerRoutes: React.FC<{ user: User }> = ({ user }) => (
  <Routes>
    <Route path="/" element={<RefillerDashboard user={user} />} />
    <Route path="/stock-out" element={<StockOut user={user} />} />
    <Route path="/reports" element={<RefillerReports />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const AppContent: React.FC = () => {
  // Session is restored synchronously, so there is no loading flash on start-up.
  const [currentUser, setCurrentUser] = useState<User | null>(() => session.restore());
  const { addToast } = useToast();

  const handleLogin = useCallback((user: User, token: string) => {
    session.save(user, token);
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    session.clear();
    api.products.invalidate();
    setCurrentUser(null);
    window.location.hash = '#/';
  }, []);

  // Any 401 from the API lands here instead of hard-navigating to a non-existent route.
  useEffect(() => {
    const onExpired = () => {
      api.products.invalidate();
      setCurrentUser(null);
      addToast(SESSION_EXPIRED_MESSAGE, 'error');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [addToast]);

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <MainLayout user={currentUser} onLogout={handleLogout}>
        <Suspense fallback={<Loading />}>
          {currentUser.role === UserRole.ADMIN ? <AdminRoutes /> : <RefillerRoutes user={currentUser} />}
        </Suspense>
      </MainLayout>
    </HashRouter>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;

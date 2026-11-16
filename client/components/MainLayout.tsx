import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { User } from '../types';
import Sidebar from './Sidebar';
import { Avatar } from './ui';

interface MainLayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

const COLLAPSE_KEY = 'sf_sidebar_collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * App shell. Desktop vs mobile behaviour is handled purely in CSS media queries,
 * so there are no resize listeners re-rendering the whole tree.
 */
const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogout, children }) => {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}${drawerOpen ? ' drawer-open' : ''}`}>
      <Sidebar user={user} onLogout={onLogout} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} onNavigate={closeDrawer} />
      <div className="scrim" onClick={closeDrawer} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
            <Menu size={22} />
          </button>
          <img src="favicon-96x96.png" alt="" className="brand-logo" width={30} height={30} />
          <span className="brand-name">MEOWENDI</span>
          <span className="spacer" />
          <Avatar name={user.name} url={user.avatarUrl} size={30} />
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
};

export default MainLayout;

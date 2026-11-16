import React, { memo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ArrowRightLeft, ChevronsLeft, ChevronsRight, FileText, LayoutDashboard, LogOut,
  PackageMinus, PackageSearch, ScrollText
} from 'lucide-react';
import { User, UserRole } from '../types';
import { Avatar } from './ui';

interface SidebarProps {
  user: User;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: () => void;
}

const ADMIN_NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventory', label: 'Inventory & Stock Out', icon: ArrowRightLeft },
  { path: '/reports', label: 'Detailed Reports', icon: FileText },
  { path: '/audit-logs', label: 'System Activity', icon: ScrollText },
];

const REFILLER_NAV = [
  { path: '/', label: 'Stock In (Entry)', icon: PackageSearch },
  { path: '/stock-out', label: 'Stock Out', icon: PackageMinus },
  { path: '/reports', label: 'My Recent Batches', icon: FileText },
];

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, collapsed, onToggleCollapsed, onNavigate }) => {
  const navItems = user.role === UserRole.ADMIN ? ADMIN_NAV : REFILLER_NAV;

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">
        <img src="favicon-96x96.png" alt="" className="brand-logo" width={34} height={34} />
        <div className="hide-collapsed">
          <div className="brand-name">MEOWENDI</div>
          <div className="brand-tag">StockFlow</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Icon size={19} />
            <span className="hide-collapsed">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip" title={collapsed ? user.name : undefined}>
          <Avatar name={user.name} url={user.avatarUrl} />
          <div className="who hide-collapsed">
            <strong>{user.name}</strong>
            <span>{user.role.toLowerCase()}</span>
          </div>
        </div>
        <button className="side-btn logout" onClick={onLogout} title={collapsed ? 'Sign out' : undefined}>
          <LogOut size={18} />
          <span className="hide-collapsed">Sign out</span>
        </button>
        <button
          className="side-btn collapse-btn"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          <span className="hide-collapsed">Collapse</span>
        </button>
      </div>
    </aside>
  );
};

export default memo(Sidebar);

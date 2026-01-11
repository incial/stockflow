
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';
import { useLayout } from '../context/LayoutContext';
import { 
  LayoutDashboard, 
  FileText, 
  LogOut, 
  PackageSearch, 
  ChevronLeft, 
  ChevronRight,
  PackageMinus,
  ShieldCheck,
  ArrowRightLeft,
  ScrollText
} from 'lucide-react';

interface SidebarProps {
  user: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const { isSidebarOpen, toggleSidebar, isMobile } = useLayout();
  const location = useLocation();

  const navItems = user.role === UserRole.ADMIN 
    ? [
        { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/inventory', label: 'Inventory & Stock Out', icon: <ArrowRightLeft size={20} /> },
        { path: '/reports', label: 'Detailed Reports', icon: <FileText size={20} /> },
        { path: '/audit-logs', label: 'System Activity', icon: <ScrollText size={20} /> },
      ]
    : [
        { path: '/', label: 'Stock In (Entry)', icon: <PackageSearch size={20} /> },
        { path: '/stock-out', label: 'Stock Out', icon: <PackageMinus size={20} /> },
      ];

  const sidebarWidthClass = isSidebarOpen ? 'w-72' : 'w-20';
  // Desktop: Fixed floating dock. Mobile: Fixed full height sheet.
  const containerClasses = isMobile 
    ? `fixed top-0 left-0 h-full w-72 bg-slate-900/95 backdrop-blur-xl z-50 transition-transform duration-300 ${!isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}`
    : `fixed top-4 left-4 bottom-4 rounded-[32px] glass-panel-dark z-50 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col ${sidebarWidthClass}`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`${containerClasses} shadow-2xl border border-white/5 overflow-hidden`}>
        {/* Header / Logo */}
        <div className={`h-24 flex items-center ${isSidebarOpen ? 'justify-between px-6' : 'justify-center'} border-b border-white/5`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0 transition-transform duration-300 hover:scale-105">
              <img 
                src="logo.png" 
                alt="Logo" 
                className="w-12 h-12 object-contain rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-sm" 
              />
            </div>
            {isSidebarOpen && (
              <div className="transition-opacity duration-300">
                <h1 className="font-black text-white text-xl tracking-tight">MEOWENDI</h1>
                <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Live</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Desktop Collapse Button */}
          {!isMobile && isSidebarOpen && (
            <button 
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-8 px-4 space-y-3 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center gap-4 px-3 py-3.5 rounded-2xl transition-all duration-300 relative ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/40'
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <div className={`${isSidebarOpen ? '' : 'mx-auto'} transition-all duration-300 relative`}>
                  {item.icon}
                  {isActive && !isSidebarOpen && (
                    <div className="absolute -right-2 -top-1 w-2 h-2 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse"></div>
                  )}
                </div>
                {isSidebarOpen && (
                  <span className={`font-medium tracking-wide text-sm whitespace-nowrap transition-all duration-300 ${isActive ? 'translate-x-1' : ''}`}>
                    {item.label}
                  </span>
                )}
                
                {/* Floating Tooltip for collapsed mode */}
                {!isSidebarOpen && !isMobile && (
                  <div className="absolute left-full ml-6 px-3 py-2 bg-slate-800/90 backdrop-blur-md text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                    {item.label}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45 border-l border-b border-white/10"></div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className={`flex items-center gap-3 ${isSidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 ring-2 ring-white/10 flex items-center justify-center text-white font-bold shadow-lg shrink-0">
              {user.name.charAt(0)}
            </div>
            
            {isSidebarOpen && (
              <div className="flex-1 overflow-hidden transition-all duration-300">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <p className="text-[10px] text-slate-400 capitalize font-medium tracking-wide">{user.role.toLowerCase()}</p>
                </div>
              </div>
            )}
          </div>
          
          {isSidebarOpen && (
            <button
                onClick={onLogout}
                className="mt-4 flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all group border border-transparent hover:border-white/5"
            >
                <LogOut size={16} className="group-hover:text-rose-400 transition-colors" />
                <span className="font-medium text-xs uppercase tracking-wider">Sign Out</span>
            </button>
          )}
          
          {!isSidebarOpen && (
             <button onClick={onLogout} className="mt-4 w-full flex justify-center text-slate-500 hover:text-rose-400 transition-colors">
                <LogOut size={20} />
             </button>
          )}
        </div>

        {/* Desktop Expand Button (Collapsed State) */}
        {!isMobile && !isSidebarOpen && (
           <div className="h-12 flex items-center justify-center border-t border-white/5 cursor-pointer hover:bg-white/5 text-slate-500 hover:text-white transition-colors" onClick={toggleSidebar}>
             <ChevronRight size={16} />
           </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;

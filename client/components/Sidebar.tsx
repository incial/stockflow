
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';
import { useLayout } from '../context/LayoutContext';
import { 
  LayoutDashboard, 
  FileText, 
  LogOut, 
  PackageSearch, 
  Store, 
  ChevronLeft, 
  ChevronRight,
  PackageMinus,
  ShieldCheck,
  ArrowRightLeft
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
      ]
    : [
        { path: '/', label: 'Stock In (Entry)', icon: <PackageSearch size={20} /> },
        { path: '/stock-out', label: 'Stock Out', icon: <PackageMinus size={20} /> },
      ];

  // Logic to determine CSS classes based on state
  const sidebarWidthClass = isSidebarOpen ? 'w-72' : 'w-20';
  const translateClass = isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0';
  
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
      <aside 
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300 shadow-2xl z-50 transition-all duration-300 ease-in-out border-r border-slate-800/50 flex flex-col ${isMobile ? 'w-72' : sidebarWidthClass} ${translateClass}`}
      >
        {/* Header / Logo */}
        <div className={`h-20 flex items-center ${isSidebarOpen ? 'justify-between px-6' : 'justify-center'} border-b border-slate-800/50`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-900/20 shrink-0">
              <Store className="text-white" size={24} />
            </div>
            {isSidebarOpen && (
              <div className="transition-opacity duration-300">
                <h1 className="font-bold text-white text-lg leading-none tracking-tight">StockFlow</h1>
                <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Premium</span>
              </div>
            )}
          </div>
          
          {/* Desktop Collapse Button */}
          {!isMobile && isSidebarOpen && (
            <button 
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-8 px-3 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 relative overflow-hidden ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                    : 'hover:bg-slate-800/50 hover:text-white text-slate-400'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20"></div>
                )}
                <div className={`${isSidebarOpen ? '' : 'mx-auto'} transition-all`}>
                  {item.icon}
                </div>
                {isSidebarOpen && (
                  <span className="font-medium tracking-wide text-sm whitespace-nowrap opacity-100 transition-opacity duration-300">
                    {item.label}
                  </span>
                )}
                
                {/* Tooltip for collapsed mode */}
                {!isSidebarOpen && !isMobile && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700 transition-opacity delay-100">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800/50 bg-slate-900/50">
          <div className={`flex items-center gap-3 ${isSidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-inner shrink-0">
              {user.name.charAt(0)}
            </div>
            
            {isSidebarOpen && (
              <div className="flex-1 overflow-hidden transition-all duration-300">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <p className="text-[10px] text-slate-400 capitalize font-medium">{user.role.toLowerCase()}</p>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={onLogout}
            className={`mt-4 flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:text-rose-200 hover:bg-rose-900/20 transition-all group ${isSidebarOpen ? '' : 'justify-center'}`}
          >
            <LogOut size={20} className="group-hover:stroke-rose-400 transition-colors" />
            {isSidebarOpen && <span className="font-medium text-sm">Sign Out</span>}
          </button>
        </div>

        {/* Desktop Expand Button (Only visible when collapsed) */}
        {!isMobile && !isSidebarOpen && (
           <div className="h-12 flex items-center justify-center border-t border-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors" onClick={toggleSidebar}>
             <ChevronRight size={16} />
           </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;

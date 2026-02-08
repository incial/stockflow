
import React from 'react';
import { User } from '../types';
import Sidebar from './Sidebar';
import { LayoutProvider, useLayout } from '../context/LayoutContext';
import { Menu } from 'lucide-react';

interface MainLayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

// Separate internal component to consume context
const LayoutContent: React.FC<MainLayoutProps> = ({ user, onLogout, children }) => {
  const { isSidebarOpen, toggleSidebar, isMobile } = useLayout();

  return (
    <div className="min-h-screen flex relative">
      <Sidebar user={user} onLogout={onLogout} />

      {/* Main Content Wrapper */}
      <div 
        className={`flex-1 flex flex-col min-h-screen transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
          // On mobile, content is always full width. On desktop, it shifts based on floating sidebar width + margins.
          isMobile ? 'ml-0' : (isSidebarOpen ? 'ml-[20rem]' : 'ml-[6.5rem]') // 20rem = w-72 (18rem) + margin (2rem) approx
        }`}
      >
        {/* Mobile Header for Sidebar Toggle */}
        {isMobile && (
          <div className="glass-panel sticky top-0 z-30 px-4 py-3 flex items-center justify-between mb-4 mx-4 mt-4 rounded-xl">
             <div className="flex items-center gap-3">
                <button 
                  onClick={toggleSidebar}
                  className="p-2 -ml-2 text-slate-600 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <Menu size={24} />
                </button>
                <div className="flex items-center gap-2">
                  <img 
                    src="logo.png" 
                    alt="Logo" 
                    className="w-8 h-8 object-contain rounded-lg" 
                  />
                  <span className="font-black text-slate-800 tracking-tight">MEOWENDI</span>
                </div>
             </div>
             {/* Mobile header avatar */}
             {user.avatarUrl ? (
               <img 
                 src={user.avatarUrl} 
                 alt={user.name}
                 className="w-8 h-8 rounded-full object-cover shadow-md"
                 onError={(e) => {
                   // Fallback to initials if image fails to load
                   e.currentTarget.style.display = 'none';
                   const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                   if (fallback) fallback.style.display = 'flex';
                 }}
               />
             ) : null}
             <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-md ${user.avatarUrl ? 'hidden' : ''}`}>
                {user.name.charAt(0)}
             </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
          <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const MainLayout: React.FC<MainLayoutProps> = (props) => {
  return (
    <LayoutProvider>
      <LayoutContent {...props} />
    </LayoutProvider>
  );
};

export default MainLayout;

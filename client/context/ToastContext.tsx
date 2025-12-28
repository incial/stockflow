import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto remove after 3 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border animate-in slide-in-from-right-10 fade-in duration-300 max-w-sm
              ${toast.type === 'success' ? 'bg-white border-emerald-100 text-slate-800' : ''}
              ${toast.type === 'error' ? 'bg-white border-rose-100 text-slate-800' : ''}
              ${toast.type === 'info' ? 'bg-white border-blue-100 text-slate-800' : ''}
            `}
          >
             <div className={`
               p-1.5 rounded-full shrink-0
               ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : ''}
               ${toast.type === 'error' ? 'bg-rose-100 text-rose-600' : ''}
               ${toast.type === 'info' ? 'bg-blue-100 text-blue-600' : ''}
             `}>
               {toast.type === 'success' && <CheckCircle size={16} />}
               {toast.type === 'error' && <AlertCircle size={16} />}
               {toast.type === 'info' && <Info size={16} />}
             </div>
             <p className="text-sm font-medium pr-2">{toast.message}</p>
             <button 
                onClick={() => removeToast(toast.id)} 
                className="ml-auto text-slate-300 hover:text-slate-500 transition-colors p-1"
             >
               <X size={14} />
             </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
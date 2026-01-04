
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { Loader2, ShieldAlert, Clock, Tag, Search, Filter, X, ChevronDown } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const { addToast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const data = await api.audit.getAll();
      // Robustly filter out login and session-related events
      const cleanLogs = data.filter(log => {
        const action = (log.action || '').toUpperCase();
        const details = (log.details || '').toUpperCase();
        
        // Check for Login/Sign-in in action
        if (action.includes('LOGIN') || action.includes('SIGN') || action.includes('AUTH')) return false;
        
        // Check for specific login phrasing in details
        if (details.includes('LOGGED IN') || details.includes('SESSION')) return false;
        
        return true;
      });
      setLogs(cleanLogs);
    } catch (error: any) {
      addToast(error.message || 'Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Action Type Filter
      if (actionFilter !== 'ALL') {
        const act = log.action.toUpperCase();
        if (actionFilter === 'CREATE' && !(act.includes('CREATE') || act.includes('ADD'))) return false;
        if (actionFilter === 'UPDATE' && !(act.includes('UPDATE') || act.includes('EDIT'))) return false;
        if (actionFilter === 'DELETE' && !(act.includes('DELETE') || act.includes('REMOVE'))) return false;
      }

      // 2. Search Query Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = 
          log.userName.toLowerCase().includes(query) ||
          log.entityType.toLowerCase().includes(query) ||
          (log.entityId || '').toLowerCase().includes(query) ||
          log.details.toLowerCase().includes(query) ||
          log.action.toLowerCase().includes(query);
        
        if (!matches) return false;
      }

      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  const getActionColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('ADD')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (act.includes('UPDATE') || act.includes('EDIT')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (act.includes('DELETE') || act.includes('REMOVE')) return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatDateTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return timestamp;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
        <p>Loading activity logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-light text-slate-900 tracking-tight">Activity Log</h2>
          <p className="text-slate-500 mt-1 text-lg">System-wide security and action tracking.</p>
        </div>
        <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 text-sm text-slate-600 font-medium">
          <ShieldAlert size={16} className="text-indigo-600" />
          <span>Restricted Access: Admin Only</span>
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative group flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by user, entity, ID or details..."
            className="w-full pl-12 pr-12 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-medium transition-all shadow-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        <div className="relative min-w-[200px]">
           <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
           <select 
             value={actionFilter}
             onChange={(e) => setActionFilter(e.target.value)}
             className="w-full appearance-none pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-bold text-slate-700 cursor-pointer shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
           >
             <option value="ALL">All Actions</option>
             <option value="CREATE">Create / Add</option>
             <option value="UPDATE">Update / Edit</option>
             <option value="DELETE">Delete / Remove</option>
           </select>
           <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      <div className="glass-panel rounded-[32px] overflow-hidden min-h-[500px]">
        {filteredLogs.length === 0 ? (
          <div className="p-20 text-center">
             <div className="bg-slate-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                {searchQuery || actionFilter !== 'ALL' ? (
                  <Search size={32} className="text-slate-300" />
                ) : (
                  <ShieldAlert size={32} className="text-slate-300" />
                )}
             </div>
             <h3 className="text-xl font-bold text-slate-700">No Logs Found</h3>
             <p className="text-slate-400 mt-2">
               {searchQuery || actionFilter !== 'ALL' 
                 ? "Try adjusting your filters or search terms." 
                 : "Audit logs will appear here once users perform actions."}
             </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-wider font-bold text-slate-400 border-b border-slate-100">
                  <th className="px-6 py-5">Time</th>
                  <th className="px-6 py-5">User</th>
                  <th className="px-6 py-5">Action</th>
                  <th className="px-6 py-5">Entity</th>
                  <th className="px-6 py-5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 font-mono text-xs">
                        <Clock size={14} className="text-slate-400" />
                        {formatDateTime(log.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 text-xs font-bold">
                          {log.userName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-700">{log.userName}</div>
                          <div className="text-[10px] text-slate-400">{log.userEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border tracking-wide uppercase ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{log.entityType}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 ml-6 opacity-50 group-hover:opacity-100 transition-opacity">
                        {log.entityId ? `ID: ${log.entityId.substring(0, 8)}...` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 max-w-xl" title={log.details}>
                        {log.details}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;

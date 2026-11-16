import React, { useDeferredValue, useMemo, useState } from 'react';
import { Filter, Search, ShieldAlert } from 'lucide-react';
import { AuditLog, AuditLogPageData } from '../types';
import { api } from '../services/api';
import { session } from '../services/session';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatIndianReadableDate, formatIndianTime } from '../utils/calculations';
import { Avatar, EmptyState, Loading, PageHeader, Pagination, ProgressBar, SearchInput, Select } from '../components/ui';

const PAGE_SIZE = 20;

type ActionKind = 'CREATE' | 'UPDATE' | 'DELETE' | 'OTHER';

const actionKind = (action: string): ActionKind => {
  const act = action.toUpperCase();
  if (act.includes('CREATE') || act.includes('ADD')) return 'CREATE';
  if (act.includes('UPDATE') || act.includes('EDIT')) return 'UPDATE';
  if (act.includes('DELETE') || act.includes('REMOVE')) return 'DELETE';
  return 'OTHER';
};

const BADGE: Record<ActionKind, string> = {
  CREATE: 'badge-success',
  UPDATE: 'badge-warning',
  DELETE: 'badge-danger',
  OTHER: '',
};

/** Sign-in/session noise is hidden from the activity view. */
const isAuthNoise = (log: AuditLog) => {
  const action = (log.action || '').toUpperCase();
  const details = (log.details || '').toUpperCase();
  return action.includes('LOGIN') || action.includes('SIGN') || action.includes('AUTH')
    || details.includes('LOGGED IN') || details.includes('SESSION');
};

const ACTION_OPTIONS = [
  { value: 'ALL', label: 'All actions' },
  { value: 'CREATE', label: 'Create / Add' },
  { value: 'UPDATE', label: 'Update / Edit' },
  { value: 'DELETE', label: 'Delete / Remove' },
];

const EMPTY: AuditLogPageData = { logs: [], page: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0 };

const AuditLogs: React.FC = () => {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const deferredQuery = useDeferredValue(searchQuery);

  const { data, initialLoading, loading } = useAsyncData(
    async (signal) => {
      if (!session.isAdmin()) return EMPTY;
      const result = await api.audit.getAll(page, PAGE_SIZE, signal);
      return { ...result, logs: result.logs.filter((log) => !isAuthNoise(log)) };
    },
    [page],
    EMPTY,
    'Failed to load audit logs'
  );

  const filteredLogs = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    return data.logs.filter((log) => {
      if (actionFilter !== 'ALL' && actionKind(log.action) !== actionFilter) return false;
      if (!query) return true;
      return [log.userName, log.userOutletName, log.entityType, log.entityId, log.details, log.action]
        .some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [data.logs, actionFilter, deferredQuery]);

  if (initialLoading) return <Loading label="Loading activity…" />;

  const filtering = Boolean(searchQuery) || actionFilter !== 'ALL';

  return (
    <div className="stack-lg page">
      <ProgressBar active={loading} />
      <PageHeader
        title="Activity log"
        subtitle="System-wide record of changes made by users."
        actions={<span className="badge badge-primary"><ShieldAlert size={13} /> Admin only</span>}
      />

      <div className="row-wrap">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Filter this page by user, entity, ID or details…" className="flex-grow" />
        <Select label="Filter by action" value={actionFilter} onChange={setActionFilter} options={ACTION_OPTIONS} icon={<Filter size={16} />} />
      </div>

      <section className="card">
        <Pagination
          page={data.page}
          size={data.size}
          totalElements={data.totalElements}
          totalPages={data.totalPages}
          onPageChange={setPage}
          disabled={loading}
        />
        <div className="table-wrap" style={{ borderTop: '1px solid var(--border)' }}>
          {filteredLogs.length === 0 ? (
            <EmptyState icon={filtering ? <Search size={24} /> : <ShieldAlert size={24} />} title="No logs found">
              {filtering ? 'Try adjusting your filters or search terms.' : 'Audit logs will appear here once users perform actions.'}
            </EmptyState>
          ) : (
            <table className="table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="num strong">{formatIndianTime(log.timestamp)}</div>
                      <div className="cell-sub">{formatIndianReadableDate(log.timestamp)}</div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={log.userName} size={30} />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-title">{log.userName}</div>
                          <div className="cell-sub">{log.userEmail} · {log.userOutletName || 'Admin'}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${BADGE[actionKind(log.action)]}`}>{log.action}</span></td>
                    <td>
                      <div className="cell-title">{log.entityType}</div>
                      {log.entityId ? <div className="cell-sub mono">ID {log.entityId}</div> : null}
                    </td>
                    <td className="muted" style={{ maxWidth: 420 }}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default AuditLogs;

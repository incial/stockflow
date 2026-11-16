import React, { useState } from 'react';
import { Filter, History, Layers, Search } from 'lucide-react';
import { AdminInventoryData } from '../types';
import { api } from '../services/api';
import { session } from '../services/session';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDate, formatNumber } from '../utils/calculations';
import { EmptyState, Loading, PageHeader, Pagination, ProgressBar, SearchInput, Select } from '../components/ui';

type Tab = 'levels' | 'history';

const PAGE_SIZE = 20;
const LOW_STOCK = 5;

const EMPTY: AdminInventoryData = {
  outlets: [],
  activeTab: 'levels',
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  search: '',
  inventoryLevels: [],
  historyLog: [],
};

const InventoryReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('levels');
  const [filterOutlet, setFilterOutlet] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, initialLoading, loading } = useAsyncData(
    (signal) =>
      session.isAdmin()
        ? api.admin.getInventory(filterOutlet ? Number(filterOutlet) : undefined, activeTab, page, PAGE_SIZE, appliedSearch || undefined, signal)
        : Promise.resolve(EMPTY),
    [filterOutlet, activeTab, page, appliedSearch],
    EMPTY,
    'Failed to load inventory'
  );

  const applySearch = () => {
    setPage(0);
    setAppliedSearch(searchInput.trim());
  };

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (!value && appliedSearch) {
      setAppliedSearch('');
      setPage(0);
    }
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setPage(0);
  };

  const outletOptions = [
    { value: '', label: 'All outlets' },
    ...data.outlets.map((outlet) => ({ value: String(outlet.id), label: outlet.name })),
  ];

  if (initialLoading) return <Loading label="Loading inventory…" />;

  // The table only reflects the tab whose data has actually arrived.
  const shownTab: Tab = data.activeTab;

  return (
    <div className="stack-lg page">
      <ProgressBar active={loading} />
      <PageHeader title="Inventory" subtitle="Live stock levels and stock-out history." />

      <div className="row-wrap">
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={activeTab === 'levels'} onClick={() => switchTab('levels')}>
            <Layers size={15} /> Stock levels
          </button>
          <button role="tab" aria-selected={activeTab === 'history'} onClick={() => switchTab('history')}>
            <History size={15} /> Movement log
          </button>
        </div>
        <span className="spacer" />
        <SearchInput value={searchInput} onChange={onSearchChange} onSubmit={applySearch} placeholder="Search product, brand or outlet…" className="flex-grow" />
        <Select
          label="Filter by outlet"
          value={filterOutlet}
          onChange={(value) => { setFilterOutlet(value); setPage(0); }}
          options={outletOptions}
          icon={<Filter size={16} />}
        />
        <button className="btn btn-primary" onClick={applySearch}>
          <Search size={16} /> Search
        </button>
      </div>

      <section className="card">
        <Pagination
          page={data.page}
          size={data.size}
          totalElements={data.totalElements}
          totalPages={data.totalPages}
          onPageChange={setPage}
          disabled={loading}
          prefix={appliedSearch ? <>Results for “{appliedSearch}” · </> : null}
        />
        <div className="table-wrap" style={{ borderTop: '1px solid var(--border)' }}>
          {shownTab === 'levels' ? (
            data.inventoryLevels.length > 0 ? (
              <table className="table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Outlet</th>
                    <th>Product</th>
                    <th className="text-right">Total in</th>
                    <th className="text-right">Total out</th>
                    <th className="text-right">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventoryLevels.map((row) => (
                    <tr key={`${row.outletId}-${row.productId}`}>
                      <td className="strong">{row.outletName}</td>
                      <td>
                        <div className="cell-title">{row.productName}</div>
                        <div className="cell-sub">{row.brand}</div>
                      </td>
                      <td className="text-right num">{formatNumber(row.totalIn)}</td>
                      <td className={`text-right num ${row.totalOut > 0 ? 'text-danger' : 'subtle'}`}>
                        {row.totalOut > 0 ? `−${formatNumber(row.totalOut)}` : '0'}
                      </td>
                      <td className="text-right">
                        <span className={`badge ${row.available <= LOW_STOCK ? 'badge-danger' : 'badge-success'}`}>
                          {formatNumber(row.available)} units
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={<Layers size={24} />} title="No inventory data found">
                {appliedSearch ? 'Try a different search term or outlet.' : 'Stock levels will appear once stock is entered.'}
              </EmptyState>
            )
          ) : data.historyLog.length > 0 ? (
            <table className="table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Outlet</th>
                  <th>Product</th>
                  <th className="text-right">Removed</th>
                  <th>Reason</th>
                  <th className="text-right">User</th>
                </tr>
              </thead>
              <tbody>
                {data.historyLog.map((log) => (
                  <tr key={log.id}>
                    <td className="num muted">{formatDate(log.date)}</td>
                    <td className="strong">{log.outletName}</td>
                    <td>
                      <div className="cell-title">{log.productName}</div>
                      <div className="cell-sub">{log.brand}</div>
                    </td>
                    <td className="text-right num text-danger strong">−{formatNumber(log.quantity)}</td>
                    <td><span className="badge">{log.reason}</span></td>
                    <td className="text-right muted">{log.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={<History size={24} />} title="No stock-out history found" />
          )}
        </div>
      </section>
    </div>
  );
};

export default InventoryReport;

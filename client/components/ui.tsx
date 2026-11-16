import React, { memo, useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';

/* ---------- Loading ---------- */

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <Loader2 size={size} className={`spin ${className}`} aria-hidden="true" />
);

export const Loading: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="loading" role="status">
    <Spinner size={28} />
    <span>{label}</span>
  </div>
);

/** Thin top progress bar for background refreshes (does not block the UI). */
export const ProgressBar: React.FC<{ active: boolean }> = ({ active }) =>
  active ? <div className="progress-bar" role="progressbar" aria-label="Loading" /> : null;

/* ---------- Layout primitives ---------- */

export const PageHeader: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <header className="page-header">
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-sub">{subtitle}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
);

export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
  </div>
);

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  alert?: boolean;
}> = memo(({ label, value, icon, tone = 'primary', alert }) => (
  <div className={`card stat${alert ? ' danger' : ''}`}>
    <div className="stat-label">
      {icon && <span className={`stat-icon ${tone}`}>{icon}</span>}
      {label}
    </div>
    <div className="stat-value">{value}</div>
  </div>
));

export const Avatar: React.FC<{ name: string; url?: string | null; size?: number }> = ({ name, url, size = 32 }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (url && url.trim() && !failed) {
    return (
      <img
        src={url}
        alt=""
        className="avatar"
        style={style}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="avatar avatar-fallback" style={style} aria-hidden="true">
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
};

/* ---------- Inputs ---------- */

export const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  className?: string;
}> = ({ value, onChange, placeholder = 'Search…', onSubmit, className = '' }) => (
  <div className={`input-wrap ${className}`}>
    <Search size={16} className="input-icon" />
    <input
      type="search"
      className="input has-action"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onSubmit) {
          e.preventDefault();
          onSubmit();
        }
      }}
    />
    {value && (
      <button type="button" className="icon-btn input-action" aria-label="Clear search" onClick={() => onChange('')}>
        <X size={14} />
      </button>
    )}
  </div>
);

export const Select: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
  label: string;
  className?: string;
}> = ({ value, onChange, options, icon, label, className = '' }) => (
  <div className={`input-wrap ${className}`} style={{ minWidth: 180 }}>
    {icon && <span className="input-icon">{icon}</span>}
    <select className="select" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </div>
);

/* ---------- Pagination ---------- */

export const Pagination: React.FC<{
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  prefix?: React.ReactNode;
}> = ({ page, size, totalElements, totalPages, onPageChange, disabled, prefix }) => {
  const from = totalElements === 0 ? 0 : page * size + 1;
  const to = totalElements === 0 ? 0 : Math.min((page + 1) * size, totalElements);
  return (
    <div className="pager">
      <span className="pager-info">
        {prefix}
        Showing <span className="num strong">{from}–{to}</span> of <span className="num strong">{totalElements}</span>
      </span>
      <div className="row">
        <button className="btn btn-outline btn-sm" disabled={disabled || page <= 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} /> Prev
        </button>
        <span className="pager-info num" style={{ minWidth: 72, textAlign: 'center' }}>
          {totalPages === 0 ? 0 : page + 1} / {totalPages}
        </span>
        <button className="btn btn-outline btn-sm" disabled={disabled || page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

/* ---------- Modal ---------- */

let openModals = 0;

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  /** Prevent closing via Esc / backdrop while an action is running. */
  locked?: boolean;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, footer, size = 'md', locked = false, children }) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openModals += 1;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockedRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openModals -= 1;
      if (openModals === 0) document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div
        ref={dialogRef}
        className={`modal${size === 'lg' ? ' modal-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="modal-title">{title}</h2>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose} disabled={locked}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

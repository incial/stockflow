/**
 * Shared building blocks for the Stock In / Stock Out entry screens.
 */
import React, { memo, useEffect } from 'react';
import { Product } from '../types';
import { sanitizeNumberInput, validatePositiveDecimal, validatePositiveInteger, validateText } from '../utils/validation';

export const MAX_QTY = 99999;
export const MAX_AMOUNT = 9999999.99;

let uidCounter = 0;
/** Collision-free ids for client-only rows (Date.now() collides on fast clicks). */
export const uid = (prefix: string) => `${prefix}-${++uidCounter}`;

export interface LineErrors {
  name?: string;
  mrp?: string;
  qty?: string;
  amt?: string;
}

const err = (result: { isValid: boolean; error?: string }) => (result.isValid ? undefined : result.error);

/**
 * Validates one entry line. Lines with nothing filled in are "empty" and simply skipped;
 * partially filled lines are invalid so nothing is silently dropped on submit.
 */
export const validateLine = (
  line: { qty: string; amt?: string; name?: string; mrp?: string },
  opts: { requireAmount: boolean; isNewProduct?: boolean; maxQty?: number }
): { empty: boolean; errors: LineErrors; valid: boolean } => {
  const filled = [line.qty, opts.requireAmount ? line.amt : '', opts.isNewProduct ? line.name : '', opts.isNewProduct ? line.mrp : '']
    .some((v) => v && v.trim() !== '');
  if (!filled) return { empty: true, errors: {}, valid: true };

  const errors: LineErrors = {
    qty: line.qty ? err(validatePositiveInteger(line.qty, 'Quantity', opts.maxQty ?? MAX_QTY)) : 'Quantity is required',
  };
  if (opts.requireAmount) {
    errors.amt = line.amt ? err(validatePositiveDecimal(line.amt, 'Total cost', MAX_AMOUNT)) : 'Total cost is required';
  }
  if (opts.isNewProduct) {
    errors.name = err(validateText(line.name ?? '', 'Product name', 1, 100, true));
    errors.mrp = line.mrp ? err(validatePositiveDecimal(line.mrp, 'MRP', MAX_AMOUNT)) : 'MRP is required';
  }
  const valid = !errors.qty && !errors.amt && !errors.name && !errors.mrp;
  return { empty: false, errors, valid };
};

/** Text input tuned for numbers: no scroll-wheel changes, numeric keyboard on phones. */
export const NumberInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  decimals?: boolean;
  placeholder?: string;
  error?: string;
  label: string;
  className?: string;
}> = memo(({ value, onChange, decimals = false, placeholder = '0', error, label, className = '' }) => (
  <input
    type="text"
    inputMode={decimals ? 'decimal' : 'numeric'}
    autoComplete="off"
    className={`input input-sm num-input${error ? ' invalid' : ''} ${className}`}
    value={value}
    placeholder={placeholder}
    aria-label={label}
    aria-invalid={Boolean(error)}
    title={error}
    maxLength={decimals ? 13 : 6}
    onChange={(e) => onChange(sanitizeNumberInput(e.target.value, decimals))}
  />
));

/** Group products by brand, preserving server order. */
export const groupByBrand = (products: Product[]): [string, Product[]][] => {
  const grouped = new Map<string, Product[]>();
  for (const p of products) {
    const list = grouped.get(p.brand);
    if (list) list.push(p);
    else grouped.set(p.brand, [p]);
  }
  return [...grouped.entries()];
};

export const matchesQuery = (p: Product, q: string) =>
  p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);

/** Warn before leaving the page with unsaved entries. */
export const useUnsavedChangesWarning = (dirty: boolean) => {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
};

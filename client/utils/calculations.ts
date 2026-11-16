import { Product } from '../types';

// Intl formatters are expensive to construct; build each one once and reuse it.
const TZ = 'Asia/Kolkata';
const currencyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const amountFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFmt = new Intl.NumberFormat('en-IN');
const shortDateFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ });
const ddmmyyyyFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ });
const readableDateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const fullDateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ });
const isoDateFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });

const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Parse an API date. Plain `YYYY-MM-DD` values are calendar dates, not UTC instants. */
const toDate = (value: string): Date | null => {
  const date = isDateOnly(value) ? new Date(`${value}T12:00:00+05:30`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const buildProductMap = (products: Product[]): Map<number, Product> =>
  new Map(products.map(product => [product.id, product]));

export const formatCurrency = (value: number): string => currencyFmt.format(Number.isFinite(value) ? value : 0);

/** Two-decimal amount without currency symbol (e.g. 1,234.50). */
export const formatAmount = (value: number): string => amountFmt.format(Number.isFinite(value) ? value : 0);

export const formatNumber = (value: number): string => numberFmt.format(Number.isFinite(value) ? value : 0);

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = toDate(dateString);
  return date ? shortDateFmt.format(date) : dateString;
};

/** DD-MM-YYYY */
export const formatIndianDate = (dateString: string): string => {
  if (!dateString) return '-';
  if (isDateOnly(dateString)) return dateString.split('-').reverse().join('-');
  const date = toDate(dateString);
  return date ? ddmmyyyyFmt.format(date).split('/').join('-') : dateString;
};

export const formatIndianTime = (dateString: string): string => {
  const date = dateString ? toDate(dateString) : null;
  return date ? timeFmt.format(date) : '-';
};

export const formatIndianReadableDate = (dateString: string): string => {
  const date = dateString ? toDate(dateString) : null;
  return date ? readableDateFmt.format(date) : '-';
};

export const formatFullDate = (date: Date = new Date()): string => fullDateFmt.format(date);

/**
 * Today's calendar date in India as YYYY-MM-DD.
 * (`toISOString()` is UTC and returns yesterday's date before 05:30 IST.)
 */
export const todayISO = (): string => isoDateFmt.format(new Date());

export const marginTone = (margin: number): 'success' | 'warning' | 'danger' =>
  margin > 20 ? 'success' : margin > 10 ? 'warning' : 'danger';

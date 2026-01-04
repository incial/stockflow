
import { StockEntry, StockOutEntry, Product, Outlet, EnrichedStockEntry } from '../types';

export const calculateEntryMetrics = (
  entry: StockEntry,
  products: Product[],
  outlets: Outlet[]
): EnrichedStockEntry => {
  const product = products.find(p => p.id === entry.productId);
  const outlet = outlets.find(o => o.id === entry.outletId);

  // Fallback values if data is missing (e.g. deleted product/outlet or data sync issue)
  const productName = product?.name || 'Unknown Product';
  const brand = product?.brand || 'Unknown Brand';
  const mrp = product?.mrp || 0;
  const outletName = outlet?.name || 'Unknown Outlet';

  const revenue = mrp * entry.quantity;
  const profit = revenue - entry.amount;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const marginPerBottle = entry.quantity > 0 ? profit / entry.quantity : 0;

  return {
    ...entry,
    productName,
    brand,
    outletName,
    mrp,
    revenue,
    profit,
    margin,
    marginPerBottle
  };
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const getAvailableStock = (
  productId: string,
  outletId: string,
  stockInEntries: StockEntry[],
  stockOutEntries: StockOutEntry[]
): number => {
  const totalIn = stockInEntries
    .filter(e => e.productId === productId && e.outletId === outletId)
    .reduce((sum, e) => sum + e.quantity, 0);

  const totalOut = stockOutEntries
    .filter(e => e.productId === productId && e.outletId === outletId)
    .reduce((sum, e) => sum + e.quantity, 0);

  return totalIn - totalOut;
};


import { StockEntry, StockOutEntry, Product, Outlet, EnrichedStockEntry } from '../types';

export interface StockAggregate {
  totalIn: number;
  totalOut: number;
  available: number;
}

export interface StockLookupMaps {
  productMap: Map<number, Product>;
  outletMap: Map<number, Outlet>;
}

export const buildProductMap = (products: Product[]): Map<number, Product> =>
  new Map(products.map(product => [product.id, product]));

export const buildOutletMap = (outlets: Outlet[]): Map<number, Outlet> =>
  new Map(outlets.map(outlet => [outlet.id, outlet]));

export const buildStockLookupMaps = (
  products: Product[],
  outlets: Outlet[]
): StockLookupMaps => ({
  productMap: buildProductMap(products),
  outletMap: buildOutletMap(outlets)
});

export const getStockAggregateKey = (productId: number, outletId: number): string =>
  `${outletId}:${productId}`;

export const buildStockAggregateMap = (
  stockInEntries: StockEntry[],
  stockOutEntries: StockOutEntry[]
): Map<string, StockAggregate> => {
  const aggregates = new Map<string, StockAggregate>();

  const getOrCreateAggregate = (productId: number, outletId: number): StockAggregate => {
    const key = getStockAggregateKey(productId, outletId);
    const existing = aggregates.get(key);
    if (existing) {
      return existing;
    }

    const created: StockAggregate = { totalIn: 0, totalOut: 0, available: 0 };
    aggregates.set(key, created);
    return created;
  };

  stockInEntries.forEach(entry => {
    const aggregate = getOrCreateAggregate(entry.productId, entry.outletId);
    aggregate.totalIn += entry.quantity;
    aggregate.available += entry.quantity;
  });

  stockOutEntries.forEach(entry => {
    const aggregate = getOrCreateAggregate(entry.productId, entry.outletId);
    aggregate.totalOut += entry.quantity;
    aggregate.available -= entry.quantity;
  });

  return aggregates;
};

export const getStockAggregate = (
  aggregateMap: Map<string, StockAggregate>,
  productId: number,
  outletId: number
): StockAggregate | undefined => aggregateMap.get(getStockAggregateKey(productId, outletId));

export const getAvailableStockFromAggregateMap = (
  aggregateMap: Map<string, StockAggregate>,
  productId: number,
  outletId: number
): number => getStockAggregate(aggregateMap, productId, outletId)?.available ?? 0;

export const calculateEntryMetrics = (
  entry: StockEntry,
  products: Product[],
  outlets: Outlet[]
): EnrichedStockEntry => {
  const { productMap, outletMap } = buildStockLookupMaps(products, outlets);

  return calculateEntryMetricsWithMaps(
    entry,
    productMap,
    outletMap
  );
};

export const calculateEntryMetricsWithMaps = (
  entry: StockEntry,
  productMap: Map<number, Product>,
  outletMap: Map<number, Outlet>
): EnrichedStockEntry => {
  const product = productMap.get(entry.productId);
  const outlet = outletMap.get(entry.outletId);

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
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

export const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  } catch (e) {
    return dateString;
  }
};

export const formatFullDate = (date?: Date): string => {
  const d = date || new Date();
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

export const getAvailableStock = (
  productId: number,
  outletId: number,
  stockInEntries: StockEntry[],
  stockOutEntries: StockOutEntry[]
): number => {
  const aggregateMap = buildStockAggregateMap(stockInEntries, stockOutEntries);
  return getAvailableStockFromAggregateMap(aggregateMap, productId, outletId);
};

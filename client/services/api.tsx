import {
  AdminDashboardData, AdminInventoryData, AdminReportsData, AuditLogPageData, Outlet, Product,
  RefillerReportsData, StockEntry, StockOutEntry, StockOutReason, User
} from '../types';
import { SESSION_EXPIRED_MESSAGE, session } from './session';



const API_BASE_URL = 'https://api.stockflow.incial.in/api/v1';

//const API_BASE_URL = 'http://localhost:8080/api/v1';


interface LoginResponse {
  token: string;
  user: User;
}

interface BatchResponse<T> {
  message: string;
  totalEntries: number;
  entries: T[];
}

export interface StockInBatchRequest {
  outletId: number;
  entryDate: string; // YYYY-MM-DD
  items: {
    productId: number;
    quantity: number;
    amount: number;
  }[];
}

export interface StockOutBatchRequest {
  outletId: number;
  entryDate: string; // YYYY-MM-DD
  items: {
    productId: number;
    quantity: number;
    reason: StockOutReason;
  }[];
}

type QueryParams = Record<string, string | number | undefined | null>;

// ============================================
// Helper Functions
// ============================================

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

const buildQuery = (params: QueryParams = {}): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const getHeaders = (withAuth = true): HeadersInit => {
  const token = withAuth ? session.getToken() : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Parse a response, translating HTTP errors into Error instances.
 * A 401 on an authenticated request ends the session (handled by the app shell).
 */
const handleResponse = async <T,>(response: Response, authenticated: boolean): Promise<T> => {
  if (response.status === 401 && authenticated) {
    session.expire();
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  if (response.ok) {
    if (response.status === 204) return {} as T;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return {} as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  const errorData = await response.json().catch(() => ({} as { message?: string }));
  throw new Error(errorData.message || `Request failed with status ${response.status}`);
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
}

const request = async <T,>(path: string, { method = 'GET', query, body, signal, auth = true }: RequestOptions = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers: getHeaders(auth),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error('Unable to reach the server. Please check your connection.');
  }
  return handleResponse<T>(response, auth);
};

/**
 * Walk a paged list endpoint, folding each page into an accumulator so the full
 * raw list never has to be held in memory at once.
 */
const foldAllPages = async <T, A>(
  path: string,
  initial: A,
  reducer: (acc: A, item: T) => A,
  { outletId, pageSize = 500, signal }: { outletId?: number; pageSize?: number; signal?: AbortSignal } = {}
): Promise<A> => {
  let acc = initial;
  for (let page = 0; page < 1000; page += 1) {
    const items = await request<T[]>(path, { query: { outletId, page, size: pageSize }, signal });
    const list = Array.isArray(items) ? items : [];
    for (const item of list) acc = reducer(acc, item);
    if (list.length < pageSize) return acc;
  }
  throw new Error(`Exceeded pagination safety limit while loading ${path}`);
};

const finite = (value: unknown, fallback: number, min = 0): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback;

// ============================================
// Product cache (shared by Stock In / Stock Out, invalidated on writes)
// ============================================

let productCache: Product[] | null = null;
let productRequest: Promise<Product[]> | null = null;

const invalidateProducts = () => {
  productCache = null;
  productRequest = null;
};

// ============================================
// API Methods
// ============================================

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

    /** The backend DTO expects the field name `credential`. */
    googleLogin: (credential: string) =>
      request<LoginResponse>('/auth/google-login', { method: 'POST', body: { credential }, auth: false }),
  },

  products: {
    /** Cached product list; concurrent callers share one in-flight request. */
    getAll: (force = false): Promise<Product[]> => {
      if (!force && productCache) return Promise.resolve(productCache);
      if (!force && productRequest) return productRequest;
      const pending = request<Product[]>('/products')
        .then((products) => {
          const list = Array.isArray(products) ? products : [];
          if (productRequest === pending) productCache = list;
          return list;
        })
        .finally(() => {
          if (productRequest === pending) productRequest = null;
        });
      productRequest = pending;
      return pending;
    },

    create: async (product: { name: string; brand: string; mrp: number }) => {
      const created = await request<Product>('/products', { method: 'POST', body: product });
      invalidateProducts();
      return created;
    },

    update: async (id: number, product: { name: string; brand: string; mrp: number }) => {
      const updated = await request<Product>(`/products/${id}`, { method: 'PUT', body: product });
      invalidateProducts();
      return updated;
    },

    delete: async (id: number) => {
      await request<void>(`/products/${id}`, { method: 'DELETE' });
      invalidateProducts();
    },

    invalidate: invalidateProducts,
  },

  outlets: {
    getAll: () => request<Outlet[]>('/outlets'),
  },

  stockIn: {
    addBatch: (payload: StockInBatchRequest) =>
      request<BatchResponse<StockEntry>>('/stock-in/batch', { method: 'POST', body: payload }),

    updateBatch: (batchId: number, batchName?: string, isChecked?: boolean) =>
      request<void>('/stock-in/batch', { method: 'PATCH', body: { batchId, batchName, isChecked } }),

    getRefillerReports: async (date?: string, signal?: AbortSignal): Promise<RefillerReportsData> => {
      const payload = await request<RefillerReportsData>('/stock-in/refiller-reports', { query: { date }, signal });
      return {
        selectedDate: payload.selectedDate ?? null,
        dates: payload.dates ?? [],
        batches: payload.batches ?? [],
      };
    },

    updateEntry: (entryId: number, quantity: number, amount: number) =>
      request<void>('/stock-in/entry', { method: 'PATCH', body: { entryId, quantity, amount } }),

    deleteBatch: (batchId: number) =>
      request<void>(`/stock-in/batch/${batchId}`, { method: 'DELETE' }),
  },

  stockOut: {
    addBatch: (payload: StockOutBatchRequest) =>
      request<BatchResponse<StockOutEntry>>('/stock-out/batch', { method: 'POST', body: payload }),
  },

  stock: {
    /**
     * Available quantity per product for an outlet (stock in − stock out).
     * Pages are folded straight into a compact map, so raw entry history is never retained.
     */
    getAvailability: async (outletId: number | undefined, signal?: AbortSignal): Promise<Map<number, number>> => {
      const add = (sign: 1 | -1) => (acc: Map<number, number>, entry: { productId: number; outletId: number; quantity: number }) => {
        if (outletId === undefined || entry.outletId === outletId) {
          acc.set(entry.productId, (acc.get(entry.productId) ?? 0) + sign * entry.quantity);
        }
        return acc;
      };
      const [stockIn, stockOut] = await Promise.all([
        foldAllPages<StockEntry, Map<number, number>>('/stock-in', new Map(), add(1), { outletId, signal }),
        foldAllPages<StockOutEntry, Map<number, number>>('/stock-out', new Map(), add(-1), { outletId, signal }),
      ]);
      stockOut.forEach((qty, productId) => stockIn.set(productId, (stockIn.get(productId) ?? 0) + qty));
      return stockIn;
    },
  },

  audit: {
    getAll: async (page = 0, size = 20, signal?: AbortSignal): Promise<AuditLogPageData> => {
      const payload = await request<AuditLogPageData>('/audit', { query: { page, size }, signal });
      return {
        logs: payload.logs ?? [],
        page: finite(payload.page, page),
        size: finite(payload.size, size, 1),
        totalElements: finite(payload.totalElements, 0),
        totalPages: finite(payload.totalPages, 0),
      };
    },
  },

  admin: {
    getDashboard: async (signal?: AbortSignal): Promise<AdminDashboardData> => {
      const payload = await request<AdminDashboardData>('/admin/dashboard', { signal });
      return {
        totalRevenue: finite(payload.totalRevenue, 0, -Infinity),
        totalProfit: finite(payload.totalProfit, 0, -Infinity),
        avgMargin: finite(payload.avgMargin, 0, -Infinity),
        totalItems: finite(payload.totalItems, 0),
        profitByOutlet: payload.profitByOutlet ?? [],
        trendData: payload.trendData ?? [],
      };
    },

    getInventory: async (
      outletId: number | undefined,
      tab: 'levels' | 'history',
      page: number,
      size: number,
      search?: string,
      signal?: AbortSignal
    ): Promise<AdminInventoryData> => {
      const payload = await request<AdminInventoryData>('/admin/inventory', { query: { outletId, tab, page, size, search }, signal });
      return {
        ...payload,
        activeTab: payload.activeTab === 'history' ? 'history' : 'levels',
        page: finite(payload.page, 0),
        size: finite(payload.size, size, 1),
        totalElements: finite(payload.totalElements, 0),
        totalPages: finite(payload.totalPages, 0),
        search: payload.search ?? '',
        inventoryLevels: payload.inventoryLevels ?? [],
        historyLog: payload.historyLog ?? [],
        outlets: payload.outlets ?? [],
      };
    },

    getReports: async (outletId?: number, date?: string, signal?: AbortSignal): Promise<AdminReportsData> => {
      const payload = await request<AdminReportsData>('/admin/reports', { query: { outletId, date }, signal });
      return {
        ...payload,
        outlets: payload.outlets ?? [],
        dates: payload.dates ?? [],
        selectedDate: payload.selectedDate ?? null,
        batches: payload.batches ?? [],
      };
    },
  },
};

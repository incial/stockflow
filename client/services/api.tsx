import {
  AdminDashboardData,AdminInventoryData,AdminReportsData,AuditLog,AuditLogPageData,Outlet,Product,RefillerReportsData,StockEntry,StockOutEntry,StockOutReason,User,UserRole
} from '../types';



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

interface FetchAllPagesOptions {
  outletId?: number;
  pageSize?: number;
}

interface StockInBatchRequest {
  outletId: number;
  entryDate: string; // YYYY-MM-DD
  items: {
    productId: number;
    quantity: number;
    amount: number;
  }[];
}

interface StockOutBatchRequest {
  outletId: number;
  entryDate: string; // YYYY-MM-DD
  items: {
    productId: number;
    quantity: number;
    reason: StockOutReason;
  }[];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get authentication headers with JWT token
 */
const getHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const getStoredUser = (): User | null => {
  const rawUser = localStorage.getItem('sm_user');
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as User;
  } catch {
    return null;
  }
};

const hasAdminSession = (): boolean => {
  const token = localStorage.getItem('token');
  const user = getStoredUser();
  return Boolean(token) && user?.role === UserRole.ADMIN;
};

/**
 * Handle API response with proper error handling
 */
const handleResponse = async <T,>(response: Response): Promise<T> => {
  // Handle unauthorized - token expired or invalid
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('sm_user');
    window.location.href = '/login'; // Or reload to trigger App guard
    throw new Error('Session expired. Please login again.');
  }

  // Handle success
  if (response.ok) {
    // Handle 204 No Content
    if (response.status === 204) return {} as T;
    
    // Check if response has content before trying to parse JSON
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    // If no content-type or content-length is 0, return empty object
    if (!contentType || contentLength === '0') {
      return {} as T;
    }
    
    // Only parse JSON if content-type indicates JSON
    if (contentType.includes('application/json')) {
      // Use text() first to check if body is empty
      const text = await response.text();
      return text ? JSON.parse(text) : {} as T;
    }
    
    // For other content types, return empty object
    return {} as T;
  }

  // Handle errors
  const errorData = await response.json().catch(() => ({
    message: 'An unexpected error occurred'
  }));

  // Log error for debugging
  console.error('API Error:', {
    status: response.status,
    error: errorData.error,
    message: errorData.message,
    errors: errorData.errors,
    path: errorData.path
  });

  // Throw error with detailed message
  throw new Error(errorData.message || `Request failed with status ${response.status}`);
};

const buildPagedQuery = (params: Record<string, string | number | undefined>): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const fetchAllPages = async <T,>(
  path: string,
  { outletId, pageSize = 500 }: FetchAllPagesOptions = {}
): Promise<T[]> => {
  const results: T[] = [];

  for (let page = 0; page < 1000; page += 1) {
    const query = buildPagedQuery({
      outletId,
      page,
      size: pageSize
    });

    const response = await fetch(`${API_BASE_URL}${path}${query}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const pageItems = await handleResponse<T[]>(response);
    results.push(...pageItems);

    if (pageItems.length < pageSize) {
      return results;
    }
  }

  throw new Error(`Exceeded pagination safety limit while loading ${path}`);
};

// ============================================
// API Methods
// ============================================

export const api = {
  session: {
    hasAdminSession,
  },
  /**
   * Authentication APIs
   */
  auth: {
    /**
     * Login with email and password
     * @param email User email
     * @param password User password
     * @returns LoginResponse with token and user data
     */
    login: async (email: string, password: string): Promise<LoginResponse> => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse<LoginResponse>(response);
    },

    /**
     * Login with Google ID Token
     * @param credential The JWT ID Token from Google
     * @returns LoginResponse with token and user data
     */
    googleLogin: async (credential: string): Promise<LoginResponse> => {
      const response = await fetch(`${API_BASE_URL}/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // IMPORTANT: The backend DTO expects field name 'credential', not 'idToken'
        body: JSON.stringify({ credential }),
      });
      return handleResponse<LoginResponse>(response);
    },
  },

  /**
   * Product APIs
   */
  products: {
    /**
     * Get all products
     * @returns Array of products
     */
    getAll: async (): Promise<Product[]> => {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse<Product[]>(response);
    },

    /**
     * Create a new product
     * @param product Product data (name, brand, mrp)
     * @returns Created product
     */
    create: async (product: { name: string; brand: string; mrp: number }): Promise<Product> => {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(product),
      });
      return handleResponse<Product>(response);
    },

    /**
     * Update an existing product
     * @param id Product ID
     * @param product Updated data
     * @returns Updated Product
     */
    update: async (id: number, product: { name: string; brand: string; mrp: number }): Promise<Product> => {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(product),
      });
      return handleResponse<Product>(response);
    },

    /**
     * Delete a product
     * @param id Product ID
     */
    delete: async (id: number): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse<void>(response);
    }
  },

  /**
   * Outlet APIs
   */
  outlets: {
    /**
     * Get all outlets (ADMIN only)
     * @returns Array of outlets
     */
    getAll: async (): Promise<Outlet[]> => {
      const response = await fetch(`${API_BASE_URL}/outlets`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse<Outlet[]>(response);
    },
  },

  /**
   * Stock In APIs
   */
  stockIn: {
    /**
     * Get stock in entries
     * @param outletId Optional outlet filter (ADMIN only, ignored for REFILLER)
     * @returns Array of stock entries
     */
    getAll: async (outletId?: number): Promise<StockEntry[]> => {
      return fetchAllPages<StockEntry>('/stock-in', { outletId, pageSize: 500 });
    },

    /**
     * Create batch stock in entries
     * @param payload Batch request with outlet, date, and items
     * @returns Batch response with created entries
     */
    addBatch: async (payload: StockInBatchRequest): Promise<BatchResponse<StockEntry>> => {
      const response = await fetch(`${API_BASE_URL}/stock-in/batch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse<BatchResponse<StockEntry>>(response);
    },

    /**
     * Update batch metadata (name and checked status)
     * @param batchId Batch ID to update
     * @param batchName Optional custom name for the batch
     * @param isChecked Optional checked status
     */
    updateBatch: async (batchId: number, batchName?: string, isChecked?: boolean): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/stock-in/batch`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ batchId, batchName, isChecked }),
      });
      return handleResponse<void>(response);
    },

    getRefillerReports: async (date?: string): Promise<RefillerReportsData> => {
      const query = buildPagedQuery({ date });
      const response = await fetch(`${API_BASE_URL}/stock-in/refiller-reports${query}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      const payload = await handleResponse<RefillerReportsData>(response);

      return {
        selectedDate: payload.selectedDate ?? null,
        dates: payload.dates ?? [],
        batches: payload.batches ?? [],
      };
    },

    updateEntry: async (entryId: number, quantity: number, amount: number): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/stock-in/entry`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ entryId, quantity, amount }),
      });
      return handleResponse<void>(response);
    },

    /**
     * Delete an entire batch by batch ID (ADMIN only)
     * @param batchId Batch ID to delete
     */
    deleteBatch: async (batchId: number): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/stock-in/batch/${batchId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse<void>(response);
    },
  },

  /**
   * Stock Out APIs
   */
  stockOut: {
    /**
     * Get stock out entries
     * @param outletId Optional outlet filter (ADMIN only, ignored for REFILLER)
     * @returns Array of stock out entries
     */
    getAll: async (outletId?: number): Promise<StockOutEntry[]> => {
      return fetchAllPages<StockOutEntry>('/stock-out', { outletId, pageSize: 500 });
    },

    /**
     * Create batch stock out entries
     * @param payload Batch request with outlet, date, and items
     * @returns Batch response with created entries
     */
    addBatch: async (payload: StockOutBatchRequest): Promise<BatchResponse<StockOutEntry>> => {
      const response = await fetch(`${API_BASE_URL}/stock-out/batch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse<BatchResponse<StockOutEntry>>(response);
    },
  },

  /**
   * Audit APIs (Admin Only)
   */
  audit: {
    /**
     * Get all audit logs
     */
    getAll: async (page = 0, size = 20): Promise<AuditLogPageData> => {
      const query = buildPagedQuery({ page, size });
      const response = await fetch(`${API_BASE_URL}/audit${query}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      const payload = await handleResponse<AuditLogPageData>(response);

      return {
        logs: payload.logs ?? [],
        page: Number.isFinite(payload.page) ? payload.page : page,
        size: Number.isFinite(payload.size) && payload.size > 0 ? payload.size : size,
        totalElements: Number.isFinite(payload.totalElements) && payload.totalElements >= 0 ? payload.totalElements : 0,
        totalPages: Number.isFinite(payload.totalPages) && payload.totalPages >= 0 ? payload.totalPages : 0,
      };
    },
  },

  admin: {
    getDashboard: async (): Promise<AdminDashboardData> => {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse<AdminDashboardData>(response);
    },

    getInventory: async (
      outletId?: number,
      tab: 'levels' | 'history' = 'levels',
      page = 0,
      size = 20,
      search?: string
    ): Promise<AdminInventoryData> => {
      const query = buildPagedQuery({ outletId, tab, page, size, search });
      const response = await fetch(`${API_BASE_URL}/admin/inventory${query}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      const payload = await handleResponse<AdminInventoryData>(response);

      return {
        ...payload,
        activeTab: payload.activeTab === 'history' ? 'history' : 'levels',
        page: Number.isFinite(payload.page) ? payload.page : 0,
        size: Number.isFinite(payload.size) && payload.size > 0 ? payload.size : size,
        totalElements: Number.isFinite(payload.totalElements) && payload.totalElements >= 0 ? payload.totalElements : 0,
        totalPages: Number.isFinite(payload.totalPages) && payload.totalPages >= 0 ? payload.totalPages : 0,
        search: payload.search ?? '',
        inventoryLevels: payload.inventoryLevels ?? [],
        historyLog: payload.historyLog ?? [],
        outlets: payload.outlets ?? [],
      };
    },

    getReports: async (outletId?: number, date?: string): Promise<AdminReportsData> => {
      const query = buildPagedQuery({ outletId, date });
      const response = await fetch(`${API_BASE_URL}/admin/reports${query}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      const payload = await handleResponse<AdminReportsData>(response);

      return {
        ...payload,
        outlets: payload.outlets ?? [],
        dates: payload.dates ?? [],
        selectedDate: payload.selectedDate ?? null,
        batches: payload.batches ?? [],
      };
    },
  }
};

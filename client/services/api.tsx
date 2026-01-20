
import { StockEntry, StockOutEntry, Product, Outlet, User, StockOutReason, AuditLog } from '../types';

// ============================================
// Configuration
// ============================================
//const API_BASE_URL = import.meta.env.API_BASE_URL || '/api/v1';

const API_BASE_URL = 'http://localhost:8080/api/v1';

// ============================================
// Types
// ============================================
interface LoginResponse {
  token: string;
  user: User;
}

interface BatchResponse<T> {
  message: string;
  totalEntries: number;
  entries: T[];
}

interface StockInBatchRequest {
  outletId: string;
  entryDate: string; // YYYY-MM-DD
  items: {
    productId: string;
    quantity: number;
    amount: number;
  }[];
}

interface StockOutBatchRequest {
  outletId: string;
  entryDate: string; // YYYY-MM-DD
  items: {
    productId: string;
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
    // Some endpoints might return empty body on success (like 201 or 204)
    if (response.status === 204) return {} as T;
    return response.json();
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

// ============================================
// API Methods
// ============================================

export const api = {
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
     * @param id Product UUID
     * @param product Updated data
     * @returns Updated Product
     */
    update: async (id: string, product: { name: string; brand: string; mrp: number }): Promise<Product> => {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(product),
      });
      return handleResponse<Product>(response);
    },

    /**
     * Delete a product
     * @param id Product UUID
     */
    delete: async (id: string): Promise<void> => {
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
    getAll: async (outletId?: string): Promise<StockEntry[]> => {
      const query = outletId ? `?outletId=${outletId}` : '';
      const response = await fetch(`${API_BASE_URL}/stock-in${query}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse<StockEntry[]>(response);
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
    getAll: async (outletId?: string): Promise<StockOutEntry[]> => {
      const query = outletId ? `?outletId=${outletId}` : '';
      const response = await fetch(`${API_BASE_URL}/stock-out${query}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse<StockOutEntry[]>(response);
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
    getAll: async (): Promise<AuditLog[]> => {
      const response = await fetch(`${API_BASE_URL}/audit`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse<AuditLog[]>(response);
    },
  }
};

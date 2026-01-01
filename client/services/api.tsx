
import { StockEntry, StockOutEntry, Product, Outlet, User } from '../types';

// Configuration - Change this if your backend runs on a different port
const API_BASE_URL = 'http://localhost:8080/api/v1';

interface LoginResponse {
  token: string;
  user: User;
}

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('sm_user');
    window.location.reload();
    throw new Error('Session expired');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'API Request Failed');
  }
  return response.json();
};

export const api = {
  auth: {
    login: async (email: string, password: string): Promise<LoginResponse> => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(response);
    },
  },
  products: {
    getAll: async (): Promise<Product[]> => {
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    create: async (product: Partial<Product>): Promise<Product> => {
       const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(product),
      });
      return handleResponse(response);
    }
  },
  outlets: {
    getAll: async (): Promise<Outlet[]> => {
      const response = await fetch(`${API_BASE_URL}/outlets`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
  },
  stockIn: {
    getAll: async (outletId?: string): Promise<StockEntry[]> => {
      const query = outletId ? `?outletId=${outletId}` : '';
      const response = await fetch(`${API_BASE_URL}/stock-in${query}`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    addBatch: async (payload: { outletId: string; entryDate: string; items: any[] }) => {
      const response = await fetch(`${API_BASE_URL}/stock-in/batch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },
  },
  stockOut: {
    getAll: async (outletId?: string): Promise<StockOutEntry[]> => {
      const query = outletId ? `?outletId=${outletId}` : '';
      const response = await fetch(`${API_BASE_URL}/stock-out${query}`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    addBatch: async (payload: { outletId: string; entryDate: string; items: any[] }) => {
      const response = await fetch(`${API_BASE_URL}/stock-out/batch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(response);
    },
  },
};

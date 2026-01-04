
export enum UserRole {
  ADMIN = 'ADMIN',
  REFILLER = 'REFILLER'
}

export interface Outlet {
  id: string;
  name: string;
  location: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string; // Grouping category (e.g., "Parle Agro")
  mrp: number; // Maximum Retail Price (per unit)
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  outletId?: string | null; // null for ADMIN, UUID for REFILLER
}

export interface StockEntry {
  id: string;
  outletId: string;
  productId: string;
  quantity: number;
  amount: number; // Total cost amount for the quantity entered
  entryDate: string;
  enteredBy: string;
  createdAt: string;
  additionalData?: Record<string, string | number>; // Dynamic fields
}

export type StockOutReason = 'Sale' | 'Damage' | 'Expiry' | 'Return' | 'Other';

export interface StockOutEntry {
  id: string;
  outletId: string;
  productId: string;
  quantity: number;
  date: string;
  reason: StockOutReason;
  enteredBy: string;
  createdAt: string;
}

export interface EnrichedStockEntry extends StockEntry {
  productName: string;
  brand: string;
  outletName: string;
  mrp: number;
  revenue: number;
  profit: number;
  margin: number;
  marginPerBottle: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  action: string; // e.g., "CREATE", "UPDATE", "LOGIN"
  entityType: string; // e.g., "Product", "StockEntry"
  entityId?: string | null;
  details: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

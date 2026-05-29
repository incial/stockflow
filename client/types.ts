
export enum UserRole {
  ADMIN = 'ADMIN',
  REFILLER = 'REFILLER'
}

export interface Outlet {
  id: number;
  name: string;
  location: string;
}

export interface Product {
  id: number;
  name: string;
  brand: string; // Grouping category (e.g., "Parle Agro")
  mrp: number; // Maximum Retail Price (per unit)
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  outletId?: number | null; // null for ADMIN, numeric ID for REFILLER
  avatarUrl?: string | null; // Profile picture URL (from Google login or manual upload)
}

export interface StockEntry {
  id: number;
  outletId: number;
  productId: number;
  quantity: number;
  amount: number; // Total cost amount for the quantity entered
  entryDate: string;
  enteredBy: number;
  createdAt: string;
  batchId?: number; // BIGINT linking entries submitted together
  batchName?: string; // Custom name assigned by admin
  isChecked?: boolean; // Checked status for admin review
  additionalData?: Record<string, string | number>; // Dynamic fields
}

export type StockOutReason = 'Sale' | 'Damage' | 'Expiry' | 'Return' | 'Other';

export interface StockOutEntry {
  id: number;
  outletId: number;
  productId: number;
  quantity: number;
  date: string;
  reason: StockOutReason;
  enteredBy: number;
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
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  action: string; // e.g., "CREATE", "UPDATE", "LOGIN"
  entityType: string; // e.g., "Product", "StockEntry"
  entityId?: number | null;
  details: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface DashboardProfitByOutlet {
  name: string;
  profit: number;
}

export interface DashboardTrendPoint {
  date: string;
  revenue: number;
  profit: number;
}

export interface AdminDashboardData {
  totalRevenue: number;
  totalProfit: number;
  avgMargin: number;
  totalItems: number;
  profitByOutlet: DashboardProfitByOutlet[];
  trendData: DashboardTrendPoint[];
}

export interface InventoryLevel {
  productId: number;
  productName: string;
  brand: string;
  outletId: number;
  outletName: string;
  totalIn: number;
  totalOut: number;
  available: number;
}

export interface InventoryHistoryItem {
  id: number;
  date: string;
  outletId: number;
  outletName: string;
  productId: number;
  productName: string;
  brand: string;
  quantity: number;
  reason: StockOutReason;
  userName: string;
  createdAt: string;
}

export interface AdminInventoryData {
  outlets: Outlet[];
  inventoryLevels: InventoryLevel[];
  historyLog: InventoryHistoryItem[];
}

export interface ReportBatchEntry {
  id: number;
  productId: number;
  productName: string;
  brand: string;
  outletName: string;
  mrp: number;
  quantity: number;
  amount: number;
  profit: number;
  margin: number;
  marginPerBottle: number;
}

export interface ReportBatch {
  batchId: number;
  entryDate: string;
  createdAt: string;
  batchNumber: number;
  batchName?: string;
  isChecked?: boolean;
  itemCount: number;
  totalAmount: number;
  totalProfit: number;
  entries: ReportBatchEntry[];
}

export interface ReportDateGroup {
  date: string;
  batches: ReportBatch[];
}

export interface AdminReportsData {
  outlets: Outlet[];
  dates: ReportDateGroup[];
}

// ==================== Auth ====================
export interface User {
  id: number;
  username: string;
  name: string;
  role: "Admin" | "Employee";
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// ==================== Products ====================
// Actual DB columns: id, sku, name, description, price, cost_price,
//   stock, min_stock, image_url, is_active, category_id, category_name, low_stock
export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  price: number;
  cost_price?: number;
  stock: number;
  min_stock: number;
  image_url?: string;
  is_active?: number;
  category_id?: number;
  category_name?: string;
  low_stock?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductFormData {
  name: string;
  sku?: string;
  price: number;
  stock: number;
  min_stock: number;
  category_id?: number | null;
  description?: string;
  cost_price?: number;
}

// ==================== Customers ====================
// Actual DB: id, name, email, phone, address, created_at, updated_at
export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at?: string;
}

export interface CustomerFormData {
  name: string;
  phone: string;
  address: string;
  email: string;
}

// ==================== Sales ====================
// Actual DB: id, invoice_number, customer_id, user_id,
//   subtotal, discount, tax, total, payment_method (cash/card/transfer),
//   payment_status (paid/pending/refunded), notes, created_at
export interface Sale {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  customer_name?: string;
  user_id: number;
  user_name?: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  payment_method: "cash" | "card" | "transfer";
  payment_status: "paid" | "pending" | "refunded";
  notes?: string;
  created_at: string;
  items?: SaleItem[];
  delivery?: Delivery | null;
}

// Actual DB: id, sale_id, product_id, quantity, unit_price, subtotal
export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface CreateSaleData {
  customer_id?: number;
  payment_method: "cash" | "transfer" | "card";
  items: Array<{ product_id: number; quantity: number }>;
  delivery?: {
    address: string;
    driver_name?: string;
    delivery_date?: string;
  };
}

// ==================== Deliveries ====================
// Actual DB: id, sale_id, delivery_date, address, status, driver_name, notes, created_at, updated_at
export interface Delivery {
  id: number;
  sale_id: number;
  delivery_date?: string;
  address: string;
  status: "Pending" | "Shipping" | "Delivered";
  driver_name?: string;
  notes?: string;
  invoice_number?: string;
  customer_name?: string;
  total?: number;
  created_at: string;
  updated_at?: string;
}

// ==================== Reports ====================
export interface DailyReport {
  date: string;
  total_sales: number;
  total_revenue: number;
  avg_order: number;
  refunds?: number;
}

export interface MonthlyReport {
  month: string;
  total_sales: number;
  total_revenue: number;
}

export interface LowStockProduct {
  id: number;
  sku: string;
  name: string;
  stock: number;
  min_stock: number;
  category_name?: string;
  shortage?: number;
}

export interface IncomeExpenseItem {
  type: "Income" | "Expense";
  total: number;
  count: number;
}

// ==================== Income & Expenses ====================
export interface IncomeExpense {
  id: number;
  transaction_date: string;
  type: "Income" | "Expense";
  amount: number;
  description: string;
  source: "manual" | "sale" | "return";
  created_at: string;
}

export interface IncomeExpenseSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  income_count: number;
  expense_count: number;
  period: { start: string | null; end: string | null };
}

export interface IncomeExpenseFormData {
  type: "Income" | "Expense";
  amount: number;
  description: string;
  transaction_date: string;
}

// ==================== Cart (POS) ====================
export interface CartItem {
  product: Product;
  quantity: number;
}

// ==================== API Response ====================
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  count?: number;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    lowStockCount?: number;
  };
}

// ==================== Toast ====================
export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

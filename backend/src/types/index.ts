/**
 * TypeScript Type Definitions
 * สำหรับระบบ IT Shop POS & Inventory Management
 */

import { RowDataPacket } from 'mysql2';

/**
 * User Role Types (matches DB ENUM: 'Admin', 'Employee')
 */
export type UserRole = 'Admin' | 'Employee';

/**
 * Payment Method Types (matches DB ENUM)
 */
export type PaymentMethod = 'cash' | 'card' | 'transfer';

/**
 * Sale Payment Status Types
 */
export type PaymentStatus = 'paid' | 'pending' | 'refunded';

/**
 * Sale Refund Status Types
 */
export type RefundStatus = 'none' | 'partial' | 'full';

/**
 * Delivery Status Types
 */
export type DeliveryStatus = 'Pending' | 'Shipping' | 'Delivered';

/**
 * Income/Expense Transaction Types
 */
export type TransactionType = 'Income' | 'Expense';

/**
 * User Interface (matches DB table: users)
 * Fields: id, username, name, password, role, created_at
 */
export interface User extends RowDataPacket {
  id: number;
  username: string;
  name: string;
  password: string;
  role: UserRole;
  created_at: Date;
}

/**
 * User safe response (no password field)
 */
export interface UserPublic {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  created_at: Date;
}

/**
 * JWT Payload stored inside the token
 */
export interface JwtPayload {
  id: number;
  username: string;
  name: string;
  role: UserRole;
}

/**
 * Extend Express Request to carry authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Customer Interface (ตาราง customers)
 */
export interface Customer extends RowDataPacket {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Product Category Interface (ตาราง categories)
 */
export interface Category extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
}

/**
 * Product Interface (ตาราง products)
 */
export interface Product extends RowDataPacket {
  id: number;
  category_id: number | null;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  image_url: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Sale Interface (matches DB table: sales)
 */
export interface Sale extends RowDataPacket {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  user_id: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  refund_status: RefundStatus;
  notes: string | null;
  created_at: Date;
}

/**
 * Sale Item Interface (ตาราง sale_items)
 */
export interface SaleItem extends RowDataPacket {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

/**
 * Delivery Interface (ตาราง deliveries)
 */
export interface Delivery extends RowDataPacket {
  id: number;
  sale_id: number;
  delivery_date: Date | null;
  address: string;
  status: DeliveryStatus;
  driver_name: string | null;
  updated_at: Date;
}

/**
 * API Response Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * API Error Interface
 */
export interface ApiError {
  status: number;
  message: string;
  details?: any;
}

/**
 * Pagination Meta
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

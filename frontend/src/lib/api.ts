import axios from "axios";
import Cookies from "js-cookie";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — attach token
api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove("token");
      Cookies.remove("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// ==================== Auth ====================
export const authApi = {
  login: (username: string, password: string) =>
    api.post("/api/auth/login", { username, password }),
  logout: () => api.post("/api/auth/logout"),
  me: () => api.get("/api/auth/me"),
  register: (data: { username: string; password: string; name: string; role: string }) =>
    api.post("/api/auth/register", data),
};

export const BASE_URL_STATIC =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ==================== Products ====================
export const productsApi = {
  getAll: (params?: { search?: string; low_stock?: boolean }) =>
    api.get("/api/products", { params }),
  getById: (id: number) => api.get(`/api/products/${id}`),
  create: (data: unknown) => api.post("/api/products", data),
  update: (id: number, data: unknown) => api.put(`/api/products/${id}`, data),
  delete: (id: number) => api.delete(`/api/products/${id}`),
  uploadImage: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return api.post(`/api/products/${id}/image`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ==================== Categories ====================
export const categoriesApi = {
  getAll: () => api.get("/api/categories"),
  create: (name: string, description?: string) =>
    api.post("/api/categories", { name, description }),
  update: (id: number, name: string, description?: string) =>
    api.put(`/api/categories/${id}`, { name, description }),
  delete: (id: number) => api.delete(`/api/categories/${id}`),
};

// ==================== Customers ====================
export const customersApi = {
  getAll: (params?: { search?: string }) =>
    api.get("/api/customers", { params }),
  getById: (id: number) => api.get(`/api/customers/${id}`),
  create: (data: unknown) => api.post("/api/customers", data),
  update: (id: number, data: unknown) => api.put(`/api/customers/${id}`, data),
  delete: (id: number) => api.delete(`/api/customers/${id}`),
};

// ==================== Sales ====================
export const salesApi = {
  getAll: (params?: { page?: number; limit?: number; start_date?: string; end_date?: string }) =>
    api.get("/api/sales", { params }),
  getById: (id: number) => api.get(`/api/sales/${id}`),
  create: (data: unknown) => api.post("/api/sales", data),
  /** Full or partial return */
  return: (
    id: number,
    body:
      | { type: "full" }
      | { type: "partial"; items: Array<{ sale_item_id: number; product_id: number; quantity: number; reason?: string }> }
  ) => api.post(`/api/sales/${id}/return`, body),
  getReturnHistory: (id: number) => api.get(`/api/sales/${id}/returns`),
};

// ==================== Deliveries ====================
export const deliveriesApi = {
  getAll: (params?: { status?: string }) =>
    api.get("/api/deliveries", { params }),
  getById: (id: number) => api.get(`/api/deliveries/${id}`),
  updateStatus: (id: number, status: string) =>
    api.patch(`/api/deliveries/${id}`, { status }),
};

// ==================== Users / Employees ====================
export const usersApi = {
  getAll: () => api.get("/api/users"),
  update: (id: number, data: { name: string; role: string }) =>
    api.put(`/api/users/${id}`, data),
  delete: (id: number) => api.delete(`/api/users/${id}`),
  resetPassword: (id: number, newPassword: string) =>
    api.put(`/api/users/${id}/reset-password`, { newPassword }),
  register: (data: { username: string; password: string; name: string; role: string }) =>
    api.post("/api/auth/register", data),
};

// ==================== Income & Expenses ====================
export const incomeExpensesApi = {
  getAll: (params?: {
    type?: string;
    source?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) => api.get("/api/income-expenses", { params }),

  getSummary: (params?: { start_date?: string; end_date?: string }) =>
    api.get("/api/income-expenses/summary", { params }),

  getById: (id: number) => api.get(`/api/income-expenses/${id}`),

  create: (data: {
    type: string;
    amount: number;
    description: string;
    transaction_date?: string;
  }) => api.post("/api/income-expenses", data),

  update: (id: number, data: {
    type: string;
    amount: number;
    description: string;
    transaction_date?: string;
  }) => api.put(`/api/income-expenses/${id}`, data),

  delete: (id: number) => api.delete(`/api/income-expenses/${id}`),
};

// ==================== Reports ====================
export const reportsApi = {
  daily: (params?: { days?: number; start_date?: string; end_date?: string }) =>
    api.get("/api/reports/daily", { params }),
  monthly: (params?: { months?: number; start_date?: string; end_date?: string }) =>
    api.get("/api/reports/monthly", { params }),
  lowStock: () => api.get("/api/reports/low-stock"),
  incomeExpenses: (params?: { start_date?: string; end_date?: string }) =>
    api.get("/api/reports/income-expenses", { params }),
  topProducts: (params?: { start_date?: string; end_date?: string; limit?: number }) =>
    api.get("/api/reports/top-products", { params }),
};

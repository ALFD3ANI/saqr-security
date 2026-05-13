/**
 * Axios client موحّد لكل طلبات الـ API
 * يُضيف الـ token تلقائياً ويعالج انتهاء الجلسة
 */
import axios from "axios";
import type { AxiosError } from "axios";
import { API_BASE } from "../lib/config";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 65000,
  headers: { "Content-Type": "application/json" },
});

// ── Request Interceptor: يُضيف الـ token لكل طلب ──────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** مسح كل بيانات الجلسة (raw keys + Zustand persist) */
function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("saqr-auth"); // Zustand persist — بدونها يُعاد بناء الجلسة عند إعادة التحميل
}

// ── Response Interceptor: يعالج انتهاء الجلسة ──────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as any;

    // 401 — حاول التجديد مرة واحدة فقط، واستثني نقطة الـ refresh نفسها
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.endsWith("/auth/refresh")
    ) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");

      if (refreshToken) {
        try {
          const res = await api.post("/auth/refresh", { refresh_token: refreshToken });
          const { access_token, refresh_token: newRefresh } = res.data;
          localStorage.setItem("access_token", access_token);
          localStorage.setItem("refresh_token", newRefresh);
          original.headers.Authorization = `Bearer ${access_token}`;
          return api(original);
        } catch {
          // refresh فشل → تسجيل خروج
        }
      }

      // لا توكن أو فشل التجديد → مسح الجلسة وإعادة التوجيه
      clearSession();

      if (
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/register") &&
        !window.location.pathname.startsWith("/forgot-password")
      ) {
        window.location.href = "/login";
      }

      // رفض صامت — الـ UI لن يعرض رسالة خطأ لأن إعادة التوجيه ستحدث
      const silentErr = new Error("auth:redirect") as any;
      silentErr.isAuthRedirect = true;
      return Promise.reject(silentErr);
    }

    // شبكة مقطوعة أو السيرفر غير متاح تماماً
    if (!error.response && error.message === "Network Error") {
      const networkErr = new Error("لا يمكن الوصول للخادم — تحقق من اتصالك أو حاول لاحقاً") as any;
      networkErr.isNetworkError = true;
      return Promise.reject(networkErr);
    }

    return Promise.reject(error);
  }
);

export default api;

// ── Subscriptions API ────────────────────────────────────────
export const subscriptionApi = {
  getUsage:   () => api.get("/subscriptions/usage"),
  getPlans:   () => api.get("/subscriptions/plans"),
  upgrade:    (plan: string, billing: string) =>
    api.post("/subscriptions/upgrade", { plan, billing }),
  checkout:   (plan: string, billing: string) =>
    api.post("/subscriptions/checkout", { plan, billing }),
  verifyPayment: (moyasarId: string) =>
    api.post(`/subscriptions/payment/${moyasarId}/verify`),
  getHistory: () => api.get("/subscriptions/history"),
  getInvoices: () => api.get("/subscriptions/invoices"),
};

// ── Auth API ─────────────────────────────────────────────────
export const authApi = {
  register: (data: RegisterPayload) => api.post("/auth/register", data),
  login: (data: LoginPayload) => api.post("/auth/login", data),
  refresh: (refresh_token: string) => api.post("/auth/refresh", { refresh_token }),
  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, new_password: string) =>
    api.post("/auth/reset-password", { token, new_password }),
  changePassword: (current: string, next: string) =>
    api.post("/auth/change-password", { current_password: current, new_password: next }),
  verifyEmail: (token: string) => api.get(`/auth/verify-email/${token}`),
  getMe: () => api.get("/auth/me"),
  setup2FA: () => api.post("/auth/2fa/setup"),
  enable2FA: (totp_code: string) => api.post("/auth/2fa/enable", { totp_code }),
  disable2FA: (totp_code: string) => api.post("/auth/2fa/disable", { totp_code }),
  updateProfile: (data: { full_name?: string; company_name?: string; phone?: string }) =>
    api.patch("/auth/profile", data),
};

// ── Scans API ─────────────────────────────────────────────────
export const scansApi = {
  create: (scan_type: string, target: string, extra?: string) =>
    api.post("/scans/", { scan_type, target, extra }, { timeout: 90000 }),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    // لا تُحدّد Content-Type يدوياً — axios يضع boundary تلقائياً مع multipart/form-data
    return api.post("/scans/upload", form, { headers: { "Content-Type": undefined } });
  },
  list: (params?: { scan_type?: string; status?: string; limit?: number; offset?: number }) =>
    api.get("/scans/", { params }),
  get:    (id: number) => api.get(`/scans/${id}`),
  delete: (id: number) => api.delete(`/scans/${id}`),
};

// ── Admin API ─────────────────────────────────────────────────
export const adminApi = {
  getStats:         () => api.get("/admin/dashboard/stats"),
  getSecurityStats: () => api.get("/admin/security/stats"),

  listUsers: (params?: { search?: string; status?: string; plan?: string; limit?: number; offset?: number }) =>
    api.get("/admin/users/", { params }),
  getUser:    (id: number) => api.get(`/admin/users/${id}`),
  updateUser: (id: number, data: { status?: string; plan?: string; role?: string; notes?: string }) =>
    api.patch(`/admin/users/${id}`, data),
  suspendUser:  (id: number) => api.post(`/admin/users/${id}/suspend`),
  activateUser: (id: number) => api.post(`/admin/users/${id}/activate`),
  banUser:      (id: number) => api.post(`/admin/users/${id}/ban`),

  listApprovals: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get("/admin/approvals/", { params }),
  getApproval: (id: number) => api.get(`/admin/approvals/${id}`),
  decide:      (id: number, decision: string, notes?: string, rejection_reason?: string) =>
    api.post(`/admin/approvals/${id}/decide`, { decision, notes, rejection_reason }),
};

// ── Types ─────────────────────────────────────────────────────
export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  company_name?: string;
  plan?: string;
  preferred_language?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  totp_code?: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  company_name?: string;
  role: string;
  status: string;
  plan: string;
  email_verified: boolean;
  totp_enabled: boolean;
  preferred_language: string;
  plan_expires_at?: string;
  created_at: string;
}

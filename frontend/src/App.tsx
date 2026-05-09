import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/i18n";
import { initTheme } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";

// Layouts
import { Navbar }    from "@/components/layout/Navbar";
import { AppLayout } from "@/components/layout/AppLayout";

// Public pages
import Landing from "@/pages/Landing";

// Auth pages
import Login           from "@/pages/auth/Login";
import Register        from "@/pages/auth/Register";
import PendingApproval from "@/pages/auth/PendingApproval";
import ForgotPassword  from "@/pages/auth/ForgotPassword";

// App pages
import Dashboard       from "@/pages/app/Dashboard";
import Billing         from "@/pages/app/Billing";
import Pricing         from "@/pages/public/Pricing";
import Scans           from "@/pages/app/Scans";
import NewScan         from "@/pages/app/NewScan";
import ScanDetail      from "@/pages/app/ScanDetail";
import AIAssistant     from "@/pages/app/AIAssistant";
import Reports         from "@/pages/app/Reports";
import Compliance      from "@/pages/app/Compliance";
import Settings        from "@/pages/app/Settings";

// Admin pages
import AdminDashboard  from "@/pages/admin/AdminDashboard";
import ApprovalQueue   from "@/pages/admin/ApprovalQueue";
import UserManagement  from "@/pages/admin/UserManagement";
import SecurityCenter  from "@/pages/admin/SecurityCenter";

// Payment
import PaymentCallback from "@/pages/app/PaymentCallback";

initTheme();
const queryClient = new QueryClient();

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.status === "pending_approval") return <Navigate to="/pending-approval" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated && user?.status === "active") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user || !["admin", "super_admin"].includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>

          {/* ── الصفحة الرئيسية ──────────────────────────── */}
          <Route path="/" element={
            <div className="min-h-screen bg-bg-dark">
              <Navbar />
              <main className="pt-16"><Landing /></main>
            </div>
          } />

          {/* ── صفحات التوثيق ────────────────────────────── */}
          <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/pending-approval" element={<PendingApproval />} />

          {/* ── صفحات التطبيق (محمية + AppLayout) ──────── */}
          <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/scans"      element={<Scans />} />
            <Route path="/scans/new"  element={<NewScan />} />
            <Route path="/scans/:id"  element={<ScanDetail />} />
            <Route path="/reports"    element={<Reports />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/ai"          element={<AIAssistant />} />
            <Route path="/billing"    element={<Billing />} />
            <Route path="/settings"   element={<Settings />} />
            {/* Admin */}
            <Route path="/admin"           element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/approvals" element={<AdminRoute><ApprovalQueue /></AdminRoute>} />
            <Route path="/admin/users"     element={<AdminRoute><UserManagement /></AdminRoute>} />
            <Route path="/admin/security"  element={<AdminRoute><SecurityCenter /></AdminRoute>} />
          </Route>

          {/* Pricing — متاحة للجميع وداخل AppLayout للمسجّلين */}
          <Route path="/pricing" element={<Pricing />} />

          {/* Payment Callback — لا تحتاج AppLayout */}
          <Route path="/payment/callback" element={<PaymentCallback />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

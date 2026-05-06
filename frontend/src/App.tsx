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
import Dashboard      from "@/pages/app/Dashboard";
import PlaceholderPage from "@/pages/app/PlaceholderPage";

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
            <Route path="/scans"      element={<PlaceholderPage title="الفحوصات" phase={7} />} />
            <Route path="/reports"    element={<PlaceholderPage title="التقارير" phase={10} />} />
            <Route path="/compliance" element={<PlaceholderPage title="الامتثال" phase={11} />} />
            <Route path="/ai"         element={<PlaceholderPage title="مساعد AI" phase={9} />} />
            <Route path="/billing"    element={<PlaceholderPage title="الفوترة" phase={6} />} />
            <Route path="/settings"   element={<PlaceholderPage title="الإعدادات" phase={12} />} />
            {/* Admin */}
            <Route path="/admin"          element={<PlaceholderPage title="Admin Dashboard" phase={12} />} />
            <Route path="/admin/users"    element={<PlaceholderPage title="User Management" phase={12} />} />
            <Route path="/admin/security" element={<PlaceholderPage title="Security Center" phase={12} />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

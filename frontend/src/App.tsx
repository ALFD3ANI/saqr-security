import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { initTheme } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { Navbar } from "@/components/layout/Navbar";

// صفحات عامة
import Landing from "@/pages/Landing";

// صفحات التوثيق
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import PendingApproval from "@/pages/auth/PendingApproval";
import ForgotPassword from "@/pages/auth/ForgotPassword";

// صفحات التطبيق
import Dashboard from "@/pages/app/Dashboard";

initTheme();

// حماية الصفحات الخاصة
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.status === "pending_approval") return <Navigate to="/pending-approval" replace />;
  return <>{children}</>;
}

// تحويل المسجّل للـ Dashboard
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated && user?.status === "active") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { i18n } = useTranslation();

  // مزامنة الـ direction مع اللغة
  useEffect(() => {
    const dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <BrowserRouter>
      <Routes>
        {/* الصفحة الرئيسية العامة (مع Navbar) */}
        <Route
          path="/"
          element={
            <div className="min-h-screen bg-bg-dark">
              <Navbar />
              <main className="pt-16">
                <Landing />
              </main>
            </div>
          }
        />

        {/* صفحات التوثيق (بدون Navbar) */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <Register />
            </PublicOnlyRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/pending-approval" element={<PendingApproval />} />

        {/* صفحات التطبيق (محمية) */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

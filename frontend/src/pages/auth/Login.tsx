import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { authApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
  totp_code: z.string().optional(),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needTotp, setNeedTotp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(data);
      const { access_token, refresh_token, user } = res.data;
      setAuth(user, access_token, refresh_token);

      // توجيه حسب الحالة
      if (user.status === "pending_approval") {
        navigate("/pending-approval");
      } else if (user.role === "admin" || user.role === "super_admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail?.error === "totp_required") {
        setNeedTotp(true);
        setError("");
      } else {
        setError(detail?.message || "حدث خطأ، حاول مرة أخرى");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
      {/* Controls */}
      <div className="fixed top-4 end-4 flex gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        {/* الشعار */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500/10 border border-primary-500/30 rounded-2xl mb-4">
            <Shield size={32} className="text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Saqr Security</h1>
          <p className="text-slate-400 text-sm mt-1">{t("common.tagline")}</p>
        </div>

        {/* البطاقة */}
        <div className="bg-surface-dark border border-slate-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            {t("auth.loginTitle")}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* الإيميل */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                {t("auth.email")}
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-3 ps-9 text-white placeholder-slate-600 outline-none transition-colors text-sm"
                  dir="ltr"
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* كلمة المرور */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-slate-400">{t("auth.password")}</label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  {...register("password")}
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-3 ps-9 pe-10 text-white placeholder-slate-600 outline-none transition-colors text-sm"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* 2FA (يظهر عند الطلب) */}
            {needTotp && (
              <div className="animate-fade-in">
                <label className="block text-sm text-slate-400 mb-1.5">
                  رمز المصادقة الثنائية (2FA)
                </label>
                <input
                  {...register("totp_code")}
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  className="w-full bg-bg-dark border border-amber-500/50 focus:border-amber-500 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none text-center text-xl tracking-widest"
                  dir="ltr"
                />
              </div>
            )}

            {/* رسالة الخطأ */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* زر الدخول */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "جاري الدخول..." : t("common.login")}
            </button>
          </form>

          {/* رابط التسجيل */}
          <p className="text-center text-slate-400 text-sm mt-6">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
              {t("common.register")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

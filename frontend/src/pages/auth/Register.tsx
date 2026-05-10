import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, Phone, User, Building2, CheckCircle2 } from "lucide-react";
import { authApi } from "@/services/api";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const PLANS = [
  { value: "free", label: "مجاني", price: "0", color: "border-slate-600" },
  { value: "starter", label: "أساسي", price: "99 ر.س", color: "border-primary-500" },
  {
    value: "professional",
    label: "احترافي ⭐",
    price: "299 ر.س",
    color: "border-accent",
    popular: true,
  },
  { value: "business", label: "تجاري", price: "999 ر.س", color: "border-purple-500" },
];

const schema = z
  .object({
    full_name: z.string().min(2, "الاسم قصير جداً").max(100),
    email: z.string().email("بريد إلكتروني غير صحيح"),
    phone: z.string().min(9, "رقم الجوال غير صحيح").optional().or(z.literal("")),
    company_name: z.string().optional(),
    password: z
      .string()
      .min(8, "8 أحرف على الأقل")
      .regex(/[A-Z]/, "يجب حرف كبير")
      .regex(/[0-9]/, "يجب رقم"),
    confirm_password: z.string(),
    plan: z.string().default("free"),
    agree_terms: z.literal(true, { errorMap: () => ({ message: "يجب الموافقة على الشروط" }) }),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "كلمات المرور غير متطابقة",
    path: ["confirm_password"],
  });

type RegisterForm = z.infer<typeof schema>;

export default function Register() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { plan: "free" },
  });

  const selectedPlan = watch("plan");

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError("");
    try {
      await authApi.register({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone: data.phone || undefined,
        company_name: data.company_name || undefined,
        plan: data.plan,
        preferred_language: i18n.language,
      });

      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail?.message || "حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
        <div className="text-center">
          <CheckCircle2 size={64} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">تم التسجيل بنجاح!</h2>
          <p className="text-slate-400">جاري التحويل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark py-10 px-4">
      <div className="fixed top-4 end-4 flex gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <div className="max-w-lg mx-auto">
        {/* الشعار */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">🦅 Saqr Security</h1>
          <p className="text-slate-400 text-sm mt-1">{t("auth.registerTitle")}</p>
        </div>

        <div className="bg-surface-dark border border-slate-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* اختيار الخطة */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">اختر خطتك</label>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map((plan) => (
                  <button
                    key={plan.value}
                    type="button"
                    onClick={() => setValue("plan", plan.value)}
                    className={`relative border-2 rounded-xl p-3 text-start transition-all ${
                      selectedPlan === plan.value
                        ? `${plan.color} bg-primary-500/10`
                        : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2 start-2 text-xs bg-accent text-white px-1.5 py-0.5 rounded-full">
                        شائع
                      </span>
                    )}
                    <div className="text-white font-medium text-sm">{plan.label}</div>
                    <div className="text-slate-400 text-xs">{plan.price}/شهر</div>
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* الاسم */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t("auth.fullName")}</label>
              <div className="relative">
                <User size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  {...register("full_name")}
                  placeholder="محمد العمري"
                  className="w-full bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-3 ps-9 text-white placeholder-slate-600 outline-none transition-colors text-sm"
                />
              </div>
              {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name.message}</p>}
            </div>

            {/* الإيميل */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t("auth.email")}</label>
              <div className="relative">
                <Mail size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  {...register("email")}
                  type="email"
                  placeholder="you@company.com"
                  className="w-full bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-3 ps-9 text-white placeholder-slate-600 outline-none transition-colors text-sm"
                  dir="ltr"
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* الجوال */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t("auth.phone")}</label>
              <div className="relative">
                <Phone size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  {...register("phone")}
                  type="tel"
                  placeholder="+966 5X XXX XXXX"
                  className="w-full bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-3 ps-9 text-white placeholder-slate-600 outline-none transition-colors text-sm"
                  dir="ltr"
                />
              </div>
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
            </div>

            {/* الشركة */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t("auth.company")}</label>
              <div className="relative">
                <Building2 size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  {...register("company_name")}
                  placeholder="شركة..."
                  className="w-full bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-3 ps-9 text-white placeholder-slate-600 outline-none transition-colors text-sm"
                />
              </div>
            </div>

            {/* كلمة المرور */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t("auth.password")}</label>
              <div className="relative">
                <Lock size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  {...register("password")}
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-3 ps-9 pe-10 text-white placeholder-slate-600 outline-none transition-colors text-sm"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* تأكيد كلمة المرور */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">{t("auth.confirmPassword")}</label>
              <div className="relative">
                <Lock size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  {...register("confirm_password")}
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-3 ps-9 text-white placeholder-slate-600 outline-none transition-colors text-sm"
                  dir="ltr"
                />
              </div>
              {errors.confirm_password && (
                <p className="text-red-400 text-xs mt-1">{errors.confirm_password.message}</p>
              )}
            </div>

            {/* الموافقة على الشروط */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                {...register("agree_terms")}
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-bg-dark text-primary-500 cursor-pointer"
              />
              <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                أوافق على{" "}
                <Link to="/terms" className="text-primary-400 hover:underline">
                  شروط الاستخدام
                </Link>{" "}
                و{" "}
                <Link to="/privacy" className="text-primary-400 hover:underline">
                  سياسة الخصوصية
                </Link>
                . أؤكد إن لدي إذن قانوني لفحص الأصول الرقمية المستهدفة.
              </span>
            </label>
            {errors.agree_terms && (
              <p className="text-red-400 text-xs">{errors.agree_terms.message}</p>
            )}

            {/* رسالة الخطأ */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* زر التسجيل */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "جاري إنشاء الحساب..." : t("common.register")}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            {t("auth.hasAccount")}{" "}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
              {t("common.login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

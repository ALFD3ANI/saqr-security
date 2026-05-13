import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, ArrowRight, CheckCircle2, Lock, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/services/api";

// ── Step 1: Request reset link ────────────────────────────────

const emailSchema = z.object({ email: z.string().email("بريد إلكتروني غير صحيح") });

function RequestResetForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(emailSchema),
  });

  const onSubmit = async (data: Record<string, string>) => {
    setLoading(true);
    try {
      await authApi.forgotPassword(data.email);
    } catch {
      // intentionally same response for security
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle2 size={64} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">تم الإرسال!</h2>
          <p className="text-slate-400 mb-6">
            إذا كان البريد موجوداً، سيصلك رابط إعادة التعيين خلال دقائق.
          </p>
          <Link to="/login" className="text-primary-400 hover:underline text-sm">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">نسيت كلمة المرور؟</h1>
          <p className="text-slate-400 text-sm">أدخل بريدك وسنرسل لك رابط الاستعادة</p>
        </div>

        <div className="bg-surface-dark border border-slate-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">البريد الإلكتروني</label>
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
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message as string}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}
              {!loading && <ArrowRight size={16} className="rtl:rotate-180" />}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-4">
            <Link to="/login" className="text-primary-400 hover:text-primary-300">
              العودة لتسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Set new password ──────────────────────────────────

const resetSchema = z
  .object({
    new_password: z
      .string()
      .min(8, "8 أحرف على الأقل")
      .regex(/[A-Z]/, "يجب حرف كبير")
      .regex(/[0-9]/, "يجب رقم"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "كلمات المرور غير متطابقة",
    path: ["confirm_password"],
  });

function ResetPasswordForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: z.infer<typeof resetSchema>) => {
    setLoading(true);
    setError("");
    try {
      await authApi.resetPassword(token, data.new_password);
      setDone(true);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setError(detail?.message ?? "فشل إعادة التعيين، الرابط قد يكون منتهياً");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle2 size={64} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">تم تغيير كلمة المرور!</h2>
          <p className="text-slate-400 mb-6">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.</p>
          <Link
            to="/login"
            className="inline-block bg-primary-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary-600"
          >
            تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">كلمة مرور جديدة</h1>
          <p className="text-slate-400 text-sm">أدخل كلمة المرور الجديدة لحسابك</p>
        </div>

        <div className="bg-surface-dark border border-slate-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">كلمة المرور الجديدة</label>
              <div className="relative">
                <Lock size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  {...register("new_password")}
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-3 ps-9 pe-10 text-white placeholder-slate-600 outline-none transition-colors text-sm"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.new_password && (
                <p className="text-red-400 text-xs mt-1">{errors.new_password.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">تأكيد كلمة المرور</label>
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
                <p className="text-red-400 text-xs mt-1">{errors.confirm_password.message as string}</p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "جاري الحفظ..." : "حفظ كلمة المرور الجديدة"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  if (token) {
    return <ResetPasswordForm token={token} />;
  }
  return <RequestResetForm />;
}

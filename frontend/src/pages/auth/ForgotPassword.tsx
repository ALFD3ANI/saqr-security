import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { authApi } from "@/services/api";

const schema = z.object({ email: z.string().email("بريد إلكتروني غير صحيح") });

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Record<string, string>) => {
    setLoading(true);
    try {
      await authApi.forgotPassword(data.email);
      setSent(true);
    } catch {
      setSent(true); // نفس الرسالة للأمان
    } finally {
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

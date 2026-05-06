import { useTranslation } from "react-i18next";
import { Clock, Mail, Shield, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";

export default function PendingApproval() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* الأيقونة */}
        <div className="relative inline-flex mb-8">
          <div className="w-24 h-24 bg-amber-500/10 border-2 border-amber-500/30 rounded-full flex items-center justify-center">
            <Clock size={40} className="text-amber-400" />
          </div>
          <div className="absolute -bottom-1 -end-1 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
        </div>

        {/* العنوان */}
        <h1 className="text-2xl font-bold text-white mb-3">
          {t("auth.pendingApproval")}
        </h1>
        <p className="text-slate-400 leading-relaxed mb-8">
          {t("auth.pendingApprovalDesc")}
        </p>

        {/* معلومات الحساب */}
        {user && (
          <div className="bg-surface-dark border border-slate-800 rounded-2xl p-6 mb-6 text-start">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">الاسم</span>
                <span className="text-white text-sm font-medium">{user.full_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">البريد الإلكتروني</span>
                <span className="text-white text-sm font-medium dir-ltr">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">الخطة</span>
                <span className="text-primary-400 text-sm font-medium capitalize">{user.plan}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">الحالة</span>
                <span className="flex items-center gap-1.5 text-amber-400 text-sm">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  قيد المراجعة
                </span>
              </div>
            </div>
          </div>
        )}

        {/* تعليمات */}
        <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-4 mb-6 text-start">
          <div className="flex gap-3">
            <Mail size={20} className="text-primary-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white text-sm font-medium mb-1">تحقق من بريدك الإلكتروني</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                سيصلك إيميل تأكيد فور الموافقة على حسابك. تأكد من مجلد الـ Spam لو ما وصلك.
              </p>
            </div>
          </div>
        </div>

        {/* الوقت المتوقع */}
        <p className="text-slate-500 text-sm mb-6">
          ⏱️ الوقت المتوقع للمراجعة: <span className="text-white">24-48 ساعة</span>
        </p>

        {/* تسجيل الخروج */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mx-auto text-slate-400 hover:text-white text-sm transition-colors"
        >
          <LogOut size={16} />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

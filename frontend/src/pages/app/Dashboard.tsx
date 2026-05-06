import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";
import { Shield, LogOut } from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-bg-dark p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield size={32} className="text-primary-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">🦅 Saqr Security</h1>
              <p className="text-slate-400 text-sm">أهلاً، {user?.full_name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm"
          >
            <LogOut size={16} />
            خروج
          </button>
        </div>

        {/* بطاقة مؤقتة */}
        <div className="bg-surface-dark border border-slate-800 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="text-xl font-bold text-white mb-2">Dashboard قيد البناء</h2>
          <p className="text-slate-400">
            المرحلة 3 ستضيف لوحة التحكم الكاملة مع الإحصائيات والفحوصات
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 text-start">
            <div className="bg-bg-dark rounded-xl p-4">
              <div className="text-slate-500 text-xs mb-1">خطتك</div>
              <div className="text-primary-400 font-semibold capitalize">{user?.plan}</div>
            </div>
            <div className="bg-bg-dark rounded-xl p-4">
              <div className="text-slate-500 text-xs mb-1">الحالة</div>
              <div className="text-green-400 font-semibold">{user?.status}</div>
            </div>
            <div className="bg-bg-dark rounded-xl p-4">
              <div className="text-slate-500 text-xs mb-1">الإيميل</div>
              <div className="text-white font-semibold text-sm" dir="ltr">{user?.email}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

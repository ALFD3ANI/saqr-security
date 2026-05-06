import { Bell, Search, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { PLAN_CONFIG, type Plan } from "@/types";

interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const plan = (user?.plan ?? "free") as Plan;
  const planCfg = PLAN_CONFIG[plan];
  const initials = user?.full_name?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <header className="h-16 border-b border-slate-800 bg-surface-dark/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      {/* يسار: زر القائمة + البحث */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <Menu size={20} />
        </button>
        <div className="relative hidden sm:block">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            placeholder={`${t("common.search")}... (Ctrl+K)`}
            className="bg-bg-dark border border-slate-700 focus:border-primary-500 rounded-xl px-4 py-2 ps-9 text-sm text-slate-300 placeholder-slate-600 outline-none w-56 transition-colors"
          />
        </div>
      </div>

      {/* يمين: إشعارات + ثيم + لغة + صورة المستخدم */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LanguageToggle />

        {/* زر الإشعارات */}
        <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* معلومات المستخدم */}
        <div className="flex items-center gap-2 ms-1">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${planCfg.bgColor} ${planCfg.color} border ${planCfg.borderColor}`}
          >
            {initials}
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="text-white text-xs font-medium">{user?.full_name}</div>
            <div className={`text-xs ${planCfg.color}`}>{planCfg.nameAr}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

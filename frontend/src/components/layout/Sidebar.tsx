import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Eye, LayoutDashboard, ScanLine, FileText, ShieldCheck,
  Bot, CreditCard, Settings, LogOut, ChevronLeft, ChevronRight,
  BarChart3, Users, Shield,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { PLAN_CONFIG, type Plan } from "@/types";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  labelKey: string;
  path: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard", path: "/dashboard" },
  { icon: ScanLine,        labelKey: "nav.scans",     path: "/scans" },
  { icon: FileText,        labelKey: "nav.reports",   path: "/reports" },
  { icon: ShieldCheck,     labelKey: "nav.compliance",path: "/compliance" },
  { icon: Bot,             labelKey: "nav.aiAssistant",path: "/ai" },
  { icon: CreditCard,      labelKey: "nav.billing",   path: "/billing" },
  { icon: Settings,        labelKey: "common.settings",path: "/settings" },
];

const ADMIN_ITEMS: NavItem[] = [
  { icon: BarChart3, labelKey: "admin.dashboard", path: "/admin", adminOnly: true },
  { icon: Users,     labelKey: "admin.users",     path: "/admin/users", adminOnly: true },
  { icon: Shield,    labelKey: "admin.security",  path: "/admin/security", adminOnly: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isRTL = i18n.language === "ar";

  const plan = (user?.plan ?? "free") as Plan;
  const planCfg = PLAN_CONFIG[plan];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-surface-dark border-e border-slate-800 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* الشعار */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <Eye size={22} className="text-primary-400 shrink-0" />
            <span className="font-bold text-white text-sm truncate">Saqr Security</span>
          </div>
        )}
        {collapsed && <Eye size={22} className="text-primary-400 mx-auto" />}
        <button
          onClick={onToggle}
          className={cn(
            "p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors",
            collapsed && "mx-auto"
          )}
        >
          {isRTL
            ? (collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
            : (collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
          }
        </button>
      </div>

      {/* الخطة الحالية */}
      {!collapsed && (
        <div className={cn("mx-3 mt-3 px-3 py-2 rounded-xl border text-xs", planCfg.bgColor, planCfg.borderColor)}>
          <div className={cn("font-semibold", planCfg.color)}>
            {t("common.plan", "الخطة")}: {planCfg.nameAr}
          </div>
          <div className="text-slate-500 mt-0.5">{user?.email}</div>
        </div>
      )}

      {/* روابط التنقل */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ icon: Icon, labelKey, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/dashboard"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary-500/15 text-primary-400 border border-primary-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800",
                collapsed && "justify-center px-2"
              )
            }
            title={collapsed ? t(labelKey) : undefined}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{t(labelKey)}</span>}
          </NavLink>
        ))}

        {/* قسم الإدارة */}
        {user?.role !== "user" && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-1 px-3">
                <span className="text-xs text-slate-600 uppercase tracking-wider">
                  {t("nav.admin", "الإدارة")}
                </span>
              </div>
            )}
            {collapsed && <div className="border-t border-slate-800 my-2" />}
            {ADMIN_ITEMS.map(({ icon: Icon, labelKey, path }) => (
              <NavLink
                key={path}
                to={path}
                end
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800",
                    collapsed && "justify-center px-2"
                  )
                }
                title={collapsed ? t(labelKey, labelKey) : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{t(labelKey, labelKey)}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* تسجيل الخروج */}
      <div className="px-2 pb-3 border-t border-slate-800 pt-2 shrink-0">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all w-full",
            collapsed && "justify-center"
          )}
          title={collapsed ? t("common.logout") : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>{t("common.logout")}</span>}
        </button>
      </div>
    </aside>
  );
}

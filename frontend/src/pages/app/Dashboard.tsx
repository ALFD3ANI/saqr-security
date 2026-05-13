import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ScanLine, ShieldAlert, FileText, Bot,
  Clock, CheckCircle2, AlertTriangle, ArrowRight, Zap, Lock, RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUsage } from "@/hooks/useUsage";
import { scansApi } from "@/services/api";
import { StatCard } from "@/components/ui/StatCard";
import { UsageBar } from "@/components/ui/UsageBar";
import { PLAN_CONFIG, type Plan } from "@/types";
import { cn, pct } from "@/lib/utils";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  return `منذ ${Math.floor(hours / 24)} ي`;
}

const STATUS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  queued:    { dot: "bg-slate-400 animate-pulse",  text: "text-slate-400",  label: "في الانتظار" },
  running:   { dot: "bg-amber-400 animate-pulse",  text: "text-amber-400",  label: "قيد الفحص"   },
  completed: { dot: "bg-emerald-400",              text: "text-emerald-400", label: "مكتمل"       },
  failed:    { dot: "bg-red-400",                  text: "text-red-400",    label: "فشل"          },
};

export default function Dashboard() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: usage, isLoading, refetch } = useUsage();
  const ar = i18n.language === "ar";

  const { data: scansData } = useQuery({
    queryKey: ["scans", "recent"],
    queryFn: () => scansApi.list({ limit: 5 }).then(r => r.data),
    staleTime: 30_000,
  });
  const recentScans = scansData?.scans ?? [];

  const plan = (user?.plan ?? "free") as Plan;
  const planCfg = PLAN_CONFIG[plan];

  const scansUsed   = usage?.scans_used    ?? 0;
  const scansLimit  = usage?.scans_limit   ?? planCfg.scansPerMonth;
  const chatUsed    = usage?.ai_chat_used  ?? 0;
  const chatLimit   = usage?.ai_chat_limit ?? planCfg.aiChatPerMonth;
  const searchUsed  = usage?.ai_search_used   ?? 0;
  const searchLimit = usage?.ai_search_limit  ?? planCfg.aiSearchPerMonth;
  const aiCost      = usage?.ai_cost_usd   ?? 0;

  const greeting = ar
    ? `أهلاً، ${user?.full_name?.split(" ")[0] ?? ""}!`
    : `Hello, ${user?.full_name?.split(" ")[0] ?? ""}!`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {ar ? "لوحة تحكم أمان الصقر 🦅" : "Saqr Security Dashboard 🦅"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            title={ar ? "تحديث" : "Refresh"}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => navigate("/scans/new")}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            <ScanLine size={16} />
            {ar ? "فحص جديد" : "New Scan"}
          </button>
        </div>
      </div>

      {/* تنبيه الترقية */}
      {plan === "free" && (
        <div className="bg-gradient-to-r from-primary-500/10 to-accent/10 border border-primary-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap size={20} className="text-accent shrink-0" />
            <div>
              <p className="text-white font-medium text-sm">
                {ar ? "أنت على الخطة المجانية" : "You're on the Free plan"}
              </p>
              <p className="text-slate-400 text-xs">
                {ar ? `${scansUsed}/${scansLimit} فحوصات · ${chatUsed}/${chatLimit} رسائل AI`
                     : `${scansUsed}/${scansLimit} scans · ${chatUsed}/${chatLimit} AI messages`}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/billing")}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            {ar ? "ترقية الخطة" : "Upgrade"} <ArrowRight size={14} className="rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* إحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={ar ? "فحوصات الشهر" : "Monthly Scans"}
          value={isLoading ? "..." : scansUsed}
          subtitle={`${ar ? "من" : "of"} ${scansLimit}`}
          icon={ScanLine}
          iconColor="text-primary-400"
        />
        <StatCard
          title={ar ? "رسائل AI" : "AI Messages"}
          value={isLoading ? "..." : chatUsed}
          subtitle={`${ar ? "من" : "of"} ${chatLimit}`}
          icon={Bot}
          iconColor="text-purple-400"
        />
        <StatCard
          title={ar ? "ثغرات مكتشفة" : "Vulnerabilities"}
          value={isLoading ? "..." : recentScans.reduce((s: number, sc: any) => s + (sc.total_findings ?? 0), 0)}
          subtitle={`${recentScans.reduce((s: number, sc: any) => s + (sc.critical_count ?? 0), 0)} حرجة`}
          icon={ShieldAlert}
          iconColor="text-red-400"
        />
        <StatCard
          title={ar ? "تكلفة AI" : "AI Cost"}
          value={`$${aiCost.toFixed(2)}`}
          subtitle={ar ? "هذا الشهر" : "this month"}
          icon={FileText}
          iconColor="text-emerald-400"
        />
      </div>

      {/* الجسم الرئيسي */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* آخر الفحوصات */}
        <div className="lg:col-span-2 bg-surface-dark border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">{ar ? "آخر الفحوصات" : "Recent Scans"}</h2>
            <button
              onClick={() => navigate("/scans")}
              className="text-primary-400 text-xs flex items-center gap-1 hover:text-primary-300"
            >
              {ar ? "عرض الكل" : "View all"} <ArrowRight size={12} className="rtl:rotate-180" />
            </button>
          </div>
          <div className="space-y-2">
            {recentScans.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                {ar ? "لا توجد فحوصات بعد" : "No scans yet"}
              </p>
            ) : recentScans.map((scan: any) => {
              const st = STATUS_STYLES[scan.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.failed;
              return (
                <div
                  key={scan.id}
                  onClick={() => navigate(`/scans/${scan.id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-bg-dark hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className={cn("w-2 h-2 rounded-full shrink-0", st.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{scan.target}</div>
                    <div className="text-slate-500 text-xs">
                      {scan.scan_type?.toUpperCase()} · {relativeTime(scan.created_at)}
                    </div>
                  </div>
                  <span className={cn("text-xs shrink-0", st.text)}>
                    {scan.status === "completed"
                      ? (scan.total_findings > 0 ? `${scan.total_findings} ثغرة` : "نظيف ✓")
                      : st.label}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => navigate("/scans/new")}
            className="mt-3 w-full border border-dashed border-slate-700 hover:border-primary-500/50 hover:bg-primary-500/5 rounded-xl py-3 text-slate-500 hover:text-primary-400 text-sm transition-all flex items-center justify-center gap-2"
          >
            <ScanLine size={16} />
            {ar ? "ابدأ فحصاً جديداً" : "Start a new scan"}
          </button>
        </div>

        {/* العمود الجانبي */}
        <div className="space-y-4">

          {/* استهلاك الخطة — بيانات حقيقية */}
          <div className="bg-surface-dark border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">
                {ar ? "استهلاك الخطة" : "Plan Usage"}
              </h2>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", planCfg.bgColor, planCfg.color, planCfg.borderColor)}>
                {ar ? planCfg.nameAr : planCfg.name}
              </span>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-6 bg-slate-800 rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-3">
                <UsageBar label={ar ? "فحوصات شهرية" : "Monthly Scans"} used={scansUsed} total={scansLimit} />
                <UsageBar label={ar ? "رسائل AI"       : "AI Messages"}  used={chatUsed}   total={chatLimit} />
                <UsageBar label={ar ? "بحث AI"         : "AI Search"}    used={searchUsed} total={searchLimit} />
              </div>
            )}
            {plan !== "enterprise" && (
              <button
                onClick={() => navigate("/billing")}
                className="mt-4 w-full text-xs text-center text-primary-400 hover:text-primary-300 transition-colors"
              >
                {ar ? "ترقية الخطة ←" : "Upgrade plan →"}
              </button>
            )}
          </div>

          {/* تنبيهات */}
          <div className="bg-surface-dark border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold text-white text-sm mb-3">{ar ? "التنبيهات" : "Alerts"}</h2>
            <div className="space-y-2">
              {pct(scansUsed, scansLimit) >= 80 && (
                <div className="flex items-start gap-2.5 text-xs">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">اقتربت من حد الفحوصات الشهري</span>
                </div>
              )}
              {(() => {
                const criticals = recentScans.reduce((s: number, sc: any) => s + (sc.critical_count ?? 0), 0);
                const lastScan  = recentScans[0];
                return (
                  <>
                    {criticals > 0 && (
                      <div className="flex items-start gap-2.5 text-xs">
                        <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <span className="text-slate-300">{criticals} ثغرة حرجة تحتاج معالجة</span>
                      </div>
                    )}
                    {criticals === 0 && recentScans.length > 0 && (
                      <div className="flex items-start gap-2.5 text-xs">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-slate-300">لا توجد ثغرات حرجة</span>
                      </div>
                    )}
                    {lastScan && (
                      <div className="flex items-start gap-2.5 text-xs">
                        <Clock size={14} className="text-slate-500 shrink-0 mt-0.5" />
                        <span className="text-slate-400">آخر فحص: {relativeTime(lastScan.created_at)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* ميزات مقفولة */}
          {(plan === "free" || plan === "starter") && (
            <div className="bg-surface-dark border border-slate-800 rounded-2xl p-5">
              <h2 className="font-semibold text-white text-sm mb-3">
                {ar ? "مميزات متاحة بالترقية" : "Available on Upgrade"}
              </h2>
              <div className="space-y-2">
                {["فحص GitHub", "فحص APK", "تقارير NCA ECC", "WAF Auto-Mitigation"].map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-slate-500">
                    <Lock size={12} className="shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

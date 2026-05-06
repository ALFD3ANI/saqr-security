import { useTranslation } from "react-i18next";
import {
  ScanLine, ShieldAlert, FileText, Bot,
  Clock, CheckCircle2, AlertTriangle,
  ArrowRight, Zap, Lock,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { StatCard } from "@/components/ui/StatCard";
import { UsageBar } from "@/components/ui/UsageBar";
import { PLAN_CONFIG, type Plan } from "@/types";
import { cn } from "@/lib/utils";

// بيانات وهمية للعرض (ستُستبدل بـ API في المرحلة 7)
const MOCK_STATS = {
  scansThisMonth: 3,
  scansToday: 1,
  vulnerabilitiesFound: 12,
  criticalVulns: 2,
  reportsGenerated: 1,
  aiMessagesUsed: 5,
  aiSearchUsed: 8,
};

const MOCK_RECENT_SCANS = [
  { id: 1, target: "mystore.sa", type: "URL", status: "completed", vulns: 5, time: "منذ ساعتين" },
  { id: 2, target: "api.myapp.com", type: "API", status: "completed", vulns: 3, time: "أمس" },
  { id: 3, target: "mobile-app.apk", type: "APK", status: "in_progress", vulns: 0, time: "الآن" },
];

const STATUS_STYLES = {
  completed:   { dot: "bg-emerald-400", label: "مكتمل",   text: "text-emerald-400" },
  in_progress: { dot: "bg-amber-400 animate-pulse", label: "قيد الفحص", text: "text-amber-400" },
  failed:      { dot: "bg-red-400",     label: "فشل",      text: "text-red-400" },
};

export default function Dashboard() {
  const { i18n } = useTranslation();
  const { user } = useAuthStore();
  const plan = (user?.plan ?? "free") as Plan;
  const planCfg = PLAN_CONFIG[plan];

  const greeting = i18n.language === "ar"
    ? `أهلاً، ${user?.full_name?.split(" ")[0] ?? ""}!`
    : `Hello, ${user?.full_name?.split(" ")[0] ?? ""}!`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {i18n.language === "ar"
              ? "مرحباً بك في لوحة تحكم أمان الصقر 🦅"
              : "Welcome to your Saqr Security dashboard 🦅"}
          </p>
        </div>
        <button className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm self-start">
          <ScanLine size={16} />
          {i18n.language === "ar" ? "فحص جديد" : "New Scan"}
        </button>
      </div>

      {/* ── بطاقة الخطة + تنبيه الترقية ───────────────────── */}
      {plan === "free" && (
        <div className="bg-gradient-to-r from-primary-500/10 to-accent/10 border border-primary-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap size={20} className="text-accent shrink-0" />
            <div>
              <p className="text-white font-medium text-sm">
                {i18n.language === "ar" ? "أنت على الخطة المجانية" : "You're on Free plan"}
              </p>
              <p className="text-slate-400 text-xs">
                {i18n.language === "ar"
                  ? "ترقّ لتحصل على فحوصات وAI أكثر"
                  : "Upgrade for more scans and AI features"}
              </p>
            </div>
          </div>
          <button className="flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0">
            {i18n.language === "ar" ? "ترقية" : "Upgrade"}
            <ArrowRight size={14} className="rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* ── إحصائيات الرئيسية ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={i18n.language === "ar" ? "فحوصات هذا الشهر" : "Scans This Month"}
          value={MOCK_STATS.scansThisMonth}
          subtitle={`من ${planCfg.scansPerMonth}`}
          icon={ScanLine}
          iconColor="text-primary-400"
          trend={{ value: 20, label: i18n.language === "ar" ? "من الشهر الماضي" : "vs last month" }}
        />
        <StatCard
          title={i18n.language === "ar" ? "ثغرات مكتشفة" : "Vulnerabilities Found"}
          value={MOCK_STATS.vulnerabilitiesFound}
          subtitle={`${MOCK_STATS.criticalVulns} حرجة`}
          icon={ShieldAlert}
          iconColor="text-red-400"
        />
        <StatCard
          title={i18n.language === "ar" ? "تقارير منشأة" : "Reports Generated"}
          value={MOCK_STATS.reportsGenerated}
          icon={FileText}
          iconColor="text-emerald-400"
        />
        <StatCard
          title={i18n.language === "ar" ? "رسائل AI" : "AI Messages"}
          value={MOCK_STATS.aiMessagesUsed}
          subtitle={`من ${planCfg.aiChatPerMonth}`}
          icon={Bot}
          iconColor="text-purple-400"
        />
      </div>

      {/* ── المحتوى الرئيسي (شبكة 2 عمود) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* آخر الفحوصات */}
        <div className="lg:col-span-2 bg-surface-dark border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">
              {i18n.language === "ar" ? "آخر الفحوصات" : "Recent Scans"}
            </h2>
            <button className="text-primary-400 hover:text-primary-300 text-xs flex items-center gap-1">
              {i18n.language === "ar" ? "عرض الكل" : "View all"}
              <ArrowRight size={12} className="rtl:rotate-180" />
            </button>
          </div>
          <div className="space-y-2">
            {MOCK_RECENT_SCANS.map((scan) => {
              const st = STATUS_STYLES[scan.status as keyof typeof STATUS_STYLES];
              return (
                <div
                  key={scan.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-bg-dark hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className={cn("w-2 h-2 rounded-full shrink-0", st.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{scan.target}</div>
                    <div className="text-slate-500 text-xs">{scan.type} · {scan.time}</div>
                  </div>
                  {scan.status === "completed" && (
                    <div className="text-xs text-slate-400 shrink-0">
                      <span className={scan.vulns > 0 ? "text-red-400" : "text-emerald-400"}>
                        {scan.vulns > 0 ? `${scan.vulns} ثغرات` : "نظيف ✓"}
                      </span>
                    </div>
                  )}
                  {scan.status === "in_progress" && (
                    <span className={cn("text-xs shrink-0", st.text)}>{st.label}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* زر فحص جديد لو ما في فحوصات */}
          <button className="mt-3 w-full border border-dashed border-slate-700 hover:border-primary-500/50 hover:bg-primary-500/5 rounded-xl py-3 text-slate-500 hover:text-primary-400 text-sm transition-all flex items-center justify-center gap-2">
            <ScanLine size={16} />
            {i18n.language === "ar" ? "ابدأ فحصاً جديداً" : "Start a new scan"}
          </button>
        </div>

        {/* الـ sidebar الجانبي */}
        <div className="space-y-4">

          {/* استهلاك الخطة */}
          <div className="bg-surface-dark border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">
                {i18n.language === "ar" ? "استهلاك الخطة" : "Plan Usage"}
              </h2>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", planCfg.bgColor, planCfg.color, planCfg.borderColor)}>
                {planCfg.nameAr}
              </span>
            </div>
            <div className="space-y-3">
              <UsageBar
                label={i18n.language === "ar" ? "فحوصات شهرية" : "Monthly Scans"}
                used={MOCK_STATS.scansThisMonth}
                total={planCfg.scansPerMonth}
              />
              <UsageBar
                label={i18n.language === "ar" ? "رسائل AI" : "AI Messages"}
                used={MOCK_STATS.aiMessagesUsed}
                total={planCfg.aiChatPerMonth}
              />
              <UsageBar
                label={i18n.language === "ar" ? "بحث AI" : "AI Search"}
                used={MOCK_STATS.aiSearchUsed}
                total={planCfg.aiSearchPerMonth}
              />
            </div>
            {plan !== "enterprise" && (
              <button className="mt-4 w-full text-xs text-center text-primary-400 hover:text-primary-300 transition-colors">
                {i18n.language === "ar" ? "ترقية الخطة ←" : "Upgrade plan →"}
              </button>
            )}
          </div>

          {/* تنبيهات سريعة */}
          <div className="bg-surface-dark border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold text-white text-sm mb-3">
              {i18n.language === "ar" ? "التنبيهات" : "Alerts"}
            </h2>
            <div className="space-y-2">
              {MOCK_STATS.criticalVulns > 0 && (
                <div className="flex items-start gap-2.5 text-xs">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">
                    {MOCK_STATS.criticalVulns}{" "}
                    {i18n.language === "ar" ? "ثغرات حرجة تحتاج معالجة" : "critical vulns need fixing"}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2.5 text-xs">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  {i18n.language === "ar" ? "البريد الإلكتروني محمي (DMARC)" : "Email secured (DMARC)"}
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs">
                <Clock size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  {i18n.language === "ar" ? "الفحص الأخير: منذ يومين" : "Last scan: 2 days ago"}
                </span>
              </div>
            </div>
          </div>

          {/* ميزات مقفولة */}
          {(plan === "free" || plan === "starter") && (
            <div className="bg-surface-dark border border-slate-800 rounded-2xl p-5">
              <h2 className="font-semibold text-white text-sm mb-3">
                {i18n.language === "ar" ? "مميزات الترقية" : "Upgrade Features"}
              </h2>
              <div className="space-y-2">
                {[
                  "فحص GitHub",
                  "فحص APK",
                  "تقارير NCA ECC",
                  "WAF Auto-Mitigation",
                ].map((f) => (
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

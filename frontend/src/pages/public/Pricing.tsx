import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePlans } from "@/hooks/useUsage";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { subscriptionApi } from "@/services/api";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const PLAN_FEATURES: Record<string, string[]> = {
  free:         ["3 فحوصات/شهر", "URL Scan فقط", "10 رسائل AI", "تقارير PDF مع علامة مائية"],
  starter:      ["25 فحص/شهر", "URL + File Scan", "200 رسائل AI", "تقارير OWASP Top 10", "دعم إيميل"],
  professional: ["100 فحص/شهر", "8 أنواع فحص", "1000 رسالة AI (Haiku+Sonnet)", "تقارير NCA ECC", "Fix Wizard", "GitHub PR Generator"],
  business:     ["500 فحص/شهر", "كل أنواع الفحص + Cloud", "5000 رسالة AI", "تقارير SAMA CSF + PDPL", "WAF Auto-Mitigation", "API Access", "دعم هاتفي"],
  enterprise:   ["10,000 فحص/شهر", "كل الميزات + Dark Web", "50,000 رسالة AI (Opus)", "تقارير ISO 27001", "Auto-Fix Engine", "White Label", "مدير حساب مخصص", "SLA 99.9%"],
};

const PLAN_COLORS: Record<string, { border: string; badge?: string }> = {
  free:         { border: "border-slate-700" },
  starter:      { border: "border-primary-500/50" },
  professional: { border: "border-accent ring-2 ring-accent/20", badge: "الأكثر شعبية" },
  business:     { border: "border-purple-500/50" },
  enterprise:   { border: "border-emerald-500/50" },
};

const PLAN_NAMES_AR: Record<string, string> = {
  free: "مجاني", starter: "أساسي", professional: "احترافي",
  business: "تجاري", enterprise: "مؤسسي",
};

export default function Pricing() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const { data: plansData, isLoading } = usePlans();
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const handleSelect = async (planKey: string) => {
    if (!isAuthenticated) { navigate("/register"); return; }
    if (planKey === "enterprise") { navigate("/contact"); return; }
    if (planKey === user?.plan) return;

    setUpgrading(planKey);
    try {
      await subscriptionApi.upgrade(planKey, billing);
      navigate("/dashboard");
      window.location.reload();
    } catch (e: any) {
      alert(e.response?.data?.detail?.message ?? "حدث خطأ");
    } finally {
      setUpgrading(null);
    }
  };

  const plans = plansData ?? [];
  const PLAN_ORDER = ["free", "starter", "professional", "business", "enterprise"];
  const sorted = PLAN_ORDER.map(k => plans.find((p: any) => p.plan === k)).filter(Boolean);

  return (
    <div className="min-h-screen bg-bg-dark py-20 px-4">
      <div className="max-w-7xl mx-auto">

        {/* العنوان */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            {ar ? "خطط تناسب كل احتياج" : "Plans for Every Need"}
          </h1>
          <p className="text-slate-400 text-lg mb-8">
            {ar ? "ابدأ مجاناً، وطوّر عند الحاجة" : "Start free, upgrade when ready"}
          </p>

          {/* Toggle شهري/سنوي */}
          <div className="inline-flex items-center bg-surface-dark border border-slate-700 rounded-xl p-1 gap-1">
            <button
              onClick={() => setBilling("monthly")}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                billing === "monthly" ? "bg-primary-500 text-white" : "text-slate-400 hover:text-white")}
            >
              {ar ? "شهري" : "Monthly"}
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                billing === "annual" ? "bg-primary-500 text-white" : "text-slate-400 hover:text-white")}
            >
              {ar ? "سنوي" : "Annual"}
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                {ar ? "وفّر 16%" : "Save 16%"}
              </span>
            </button>
          </div>
        </div>

        {/* بطاقات الخطط */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-96 bg-surface-dark rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {sorted.map((plan: any) => {
              const style = PLAN_COLORS[plan.plan] ?? { border: "border-slate-700" };
              const features = PLAN_FEATURES[plan.plan] ?? [];
              const price = billing === "annual"
                ? Math.round(plan.price_annual_sar / 12)
                : plan.price_monthly_sar;
              const isCurrent = user?.plan === plan.plan;
              const isEnterprise = plan.plan === "enterprise";

              return (
                <div
                  key={plan.plan}
                  className={cn(
                    "relative flex flex-col bg-surface-dark border-2 rounded-2xl p-6",
                    style.border
                  )}
                >
                  {style.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      <Star size={10} /> {style.badge}
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="font-bold text-white text-lg">
                      {ar ? PLAN_NAMES_AR[plan.plan] : plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1)}
                    </h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">
                        {isEnterprise ? "4,999+" : price}
                      </span>
                      {!isEnterprise && price > 0 && (
                        <span className="text-slate-400 text-sm">
                          ر.س/{ar ? "شهر" : "mo"}
                        </span>
                      )}
                      {price === 0 && <span className="text-slate-400 text-sm">ر.س</span>}
                    </div>
                    {billing === "annual" && plan.price_annual_sar > 0 && !isEnterprise && (
                      <p className="text-emerald-400 text-xs mt-1">
                        {plan.price_annual_sar} ر.س/{ar ? "سنة" : "year"}
                      </p>
                    )}
                  </div>

                  {/* الميزات */}
                  <div className="flex-1 space-y-2 mb-6">
                    {features.map(f => (
                      <div key={f} className="flex items-start gap-2 text-sm">
                        <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-slate-300">{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* الزر */}
                  <button
                    onClick={() => handleSelect(plan.plan)}
                    disabled={isCurrent || upgrading === plan.plan}
                    className={cn(
                      "w-full py-2.5 rounded-xl font-semibold text-sm transition-all",
                      isCurrent
                        ? "bg-slate-700 text-slate-400 cursor-default"
                        : plan.plan === "professional"
                          ? "bg-accent hover:bg-accent-dark text-white"
                          : "bg-slate-800 hover:bg-slate-700 text-white",
                      upgrading === plan.plan && "opacity-60 cursor-wait"
                    )}
                  >
                    {isCurrent
                      ? (ar ? "خطتك الحالية" : "Current Plan")
                      : isEnterprise
                        ? (ar ? "تواصل معنا" : "Contact Us")
                        : upgrading === plan.plan
                          ? (ar ? "جاري..." : "Loading...")
                          : (ar ? "ابدأ الآن" : "Get Started")}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ملاحظة الضمان */}
        <p className="text-center text-slate-500 text-sm mt-10">
          {ar
            ? "✓ لا يوجد عقد مُلزم · ✓ يمكن الإلغاء في أي وقت · ✓ ضمان استرداد المبلغ خلال 14 يوم"
            : "✓ No contracts · ✓ Cancel anytime · ✓ 14-day money-back guarantee"}
        </p>
      </div>
    </div>
  );
}

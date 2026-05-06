import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUsage } from "@/hooks/useUsage";
import { useQuery } from "@tanstack/react-query";
import { subscriptionApi } from "@/services/api";
import { UsageBar } from "@/components/ui/UsageBar";
import { PLAN_CONFIG, type Plan } from "@/types";
import { cn } from "@/lib/utils";
import { CreditCard, Zap, History, TrendingUp } from "lucide-react";

export default function Billing() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const { user } = useAuthStore();
  const { data: usage } = useUsage();
  const navigate = useNavigate();

  const plan = (user?.plan ?? "free") as Plan;
  const planCfg = PLAN_CONFIG[plan];

  const { data: historyData } = useQuery({
    queryKey: ["subscription-history"],
    queryFn: async () => {
      const res = await subscriptionApi.getHistory();
      return res.data.subscriptions as any[];
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white">
        {ar ? "الفوترة والاشتراك" : "Billing & Subscription"}
      </h1>

      {/* الخطة الحالية */}
      <div className={cn("border-2 rounded-2xl p-6", planCfg.borderColor, planCfg.bgColor)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-slate-400 text-sm mb-1">{ar ? "خطتك الحالية" : "Current Plan"}</p>
            <h2 className={cn("text-2xl font-bold", planCfg.color)}>
              {ar ? planCfg.nameAr : planCfg.name}
            </h2>
            {user?.plan_expires_at && (
              <p className="text-slate-400 text-xs mt-1">
                {ar ? "تنتهي في:" : "Expires:"}{" "}
                {new Date(user.plan_expires_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}
              </p>
            )}
          </div>
          {plan !== "enterprise" && (
            <button
              onClick={() => navigate("/pricing")}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <TrendingUp size={16} />
              {ar ? "ترقية" : "Upgrade"}
            </button>
          )}
        </div>
      </div>

      {/* الاستهلاك الحالي */}
      <div className="bg-surface-dark border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} className="text-accent" />
          <h2 className="font-semibold text-white">
            {ar ? "استهلاك هذا الشهر" : "This Month's Usage"}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UsageBar
            label={ar ? "فحوصات شهرية" : "Monthly Scans"}
            used={usage?.scans_used ?? 0}
            total={usage?.scans_limit ?? planCfg.scansPerMonth}
          />
          <UsageBar
            label={ar ? "فحوصات اليوم" : "Today's Scans"}
            used={usage?.scans_today ?? 0}
            total={usage?.scans_daily_limit ?? planCfg.scansPerDay}
          />
          <UsageBar
            label={ar ? "رسائل AI شهرية" : "Monthly AI Chat"}
            used={usage?.ai_chat_used ?? 0}
            total={usage?.ai_chat_limit ?? planCfg.aiChatPerMonth}
          />
          <UsageBar
            label={ar ? "بحث AI شهري" : "Monthly AI Search"}
            used={usage?.ai_search_used ?? 0}
            total={usage?.ai_search_limit ?? planCfg.aiSearchPerMonth}
          />
        </div>
        {(usage?.ai_cost_usd ?? 0) > 0 && (
          <p className="mt-4 text-slate-400 text-xs">
            {ar ? "تكلفة AI هذا الشهر:" : "AI cost this month:"}{" "}
            <span className="text-white font-medium">${(usage?.ai_cost_usd ?? 0).toFixed(4)}</span>
          </p>
        )}
      </div>

      {/* تاريخ الاشتراكات */}
      <div className="bg-surface-dark border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <History size={18} className="text-primary-400" />
          <h2 className="font-semibold text-white">
            {ar ? "تاريخ الاشتراكات" : "Subscription History"}
          </h2>
        </div>
        {!historyData || historyData.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            {ar ? "لا يوجد تاريخ اشتراكات بعد" : "No subscription history yet"}
          </p>
        ) : (
          <div className="space-y-2">
            {historyData.map((sub: any) => (
              <div key={sub.id} className="flex items-center justify-between p-3 bg-bg-dark rounded-xl text-sm">
                <div>
                  <span className="text-white font-medium capitalize">{sub.plan}</span>
                  {sub.prev_plan && (
                    <span className="text-slate-500"> ← {sub.prev_plan}</span>
                  )}
                  <div className="text-slate-500 text-xs mt-0.5">
                    {new Date(sub.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-white">{sub.amount_sar} ر.س</div>
                  <div className="text-slate-500 text-xs">{sub.billing}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* بطاقة الدفع (placeholder) */}
      <div className="bg-surface-dark border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={18} className="text-slate-400" />
          <h2 className="font-semibold text-white">
            {ar ? "طريقة الدفع" : "Payment Method"}
          </h2>
        </div>
        <div className="border border-dashed border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-500 text-sm">
            {ar
              ? "تكامل Moyasar سيُضاف في المرحلة 6 🔜"
              : "Moyasar payment integration coming in Phase 6 🔜"}
          </p>
        </div>
      </div>
    </div>
  );
}

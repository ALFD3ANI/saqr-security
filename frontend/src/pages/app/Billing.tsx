import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUsage } from "@/hooks/useUsage";
import { useQuery } from "@tanstack/react-query";
import { subscriptionApi } from "@/services/api";
import api from "@/services/api";
import { UsageBar } from "@/components/ui/UsageBar";
import { PLAN_CONFIG, type Plan } from "@/types";
import { cn } from "@/lib/utils";
import {
  CreditCard, Zap, History, TrendingUp, FileText, ExternalLink, CheckCircle2
} from "lucide-react";

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
    queryFn: async () => (await subscriptionApi.getHistory()).data.subscriptions as any[],
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await api.get("/subscriptions/invoices")).data.invoices as any[],
  });

  const invoices: any[] = invoicesData ?? [];
  const history: any[] = historyData ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary">
        {ar ? "الفوترة والاشتراك" : "Billing & Subscription"}
      </h1>

      {/* الخطة الحالية */}
      <div className={cn("border-2 rounded-2xl p-6", planCfg.borderColor, planCfg.bgColor)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-text-muted text-sm mb-1">{ar ? "خطتك الحالية" : "Current Plan"}</p>
            <h2 className={cn("text-2xl font-bold", planCfg.color)}>
              {ar ? planCfg.nameAr : planCfg.name}
            </h2>
            {user?.plan_expires_at && (
              <p className="text-text-muted text-xs mt-1">
                {ar ? "تنتهي في:" : "Expires:"}{" "}
                {new Date(user.plan_expires_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}
              </p>
            )}
          </div>
          {plan !== "enterprise" && (
            <button
              onClick={() => navigate("/pricing")}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-bg-dark text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <TrendingUp size={16} />
              {ar ? "ترقية الخطة" : "Upgrade"}
            </button>
          )}
        </div>
      </div>

      {/* الاستهلاك */}
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap size={18} className="text-primary" />
          <h2 className="font-semibold text-text-primary">
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
          <p className="mt-4 text-text-muted text-xs">
            {ar ? "تكلفة AI هذا الشهر:" : "AI cost this month:"}{" "}
            <span className="text-text-primary font-medium">${(usage?.ai_cost_usd ?? 0).toFixed(4)}</span>
          </p>
        )}
      </div>

      {/* الفواتير */}
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileText size={18} className="text-primary" />
          <h2 className="font-semibold text-text-primary">
            {ar ? "الفواتير" : "Invoices"}
          </h2>
        </div>
        {invoices.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-6">
            {ar ? "لا توجد فواتير بعد" : "No invoices yet"}
          </p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 bg-bg-dark rounded-xl text-sm border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                  <div>
                    <div className="text-text-primary font-mono text-xs">{inv.invoice_number}</div>
                    <div className="text-text-muted text-xs capitalize">
                      {inv.plan} · {inv.billing} · {new Date(inv.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}
                    </div>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-text-primary font-semibold">{inv.amount_sar} ر.س</div>
                  <div className="text-green-400 text-xs">مدفوعة</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* تاريخ الاشتراكات */}
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <History size={18} className="text-primary" />
          <h2 className="font-semibold text-text-primary">
            {ar ? "تاريخ الاشتراكات" : "Subscription History"}
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-4">
            {ar ? "لا يوجد تاريخ اشتراكات بعد" : "No subscription history yet"}
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((sub: any) => (
              <div
                key={sub.id}
                className="flex items-center justify-between p-3 bg-bg-dark rounded-xl text-sm"
              >
                <div>
                  <span className="text-text-primary font-medium capitalize">{sub.plan}</span>
                  {sub.prev_plan && (
                    <span className="text-text-muted"> ← {sub.prev_plan}</span>
                  )}
                  <div className="text-text-muted text-xs mt-0.5">
                    {new Date(sub.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-text-primary">{sub.amount_sar} ر.س</div>
                  <div className="text-text-muted text-xs">{sub.billing}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* طريقة الدفع */}
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={18} className="text-text-muted" />
          <h2 className="font-semibold text-text-primary">
            {ar ? "طريقة الدفع" : "Payment Method"}
          </h2>
        </div>
        <div className="flex items-center gap-4 p-4 bg-bg-dark rounded-xl border border-border/50">
          <div className="p-3 bg-primary/10 rounded-xl">
            <CreditCard size={20} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-text-primary text-sm font-medium">Moyasar</p>
            <p className="text-text-muted text-xs">
              {ar
                ? "بطاقة ائتمان · مدى · Apple Pay · STC Pay"
                : "Credit Card · Mada · Apple Pay · STC Pay"}
            </p>
          </div>
          {plan !== "enterprise" && (
            <button
              onClick={() => navigate("/pricing")}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/30 px-3 py-1.5 rounded-lg"
            >
              <ExternalLink size={12} />
              {ar ? "إدارة" : "Manage"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

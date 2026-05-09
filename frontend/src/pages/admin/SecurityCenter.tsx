import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import {
  ScanLine, Bot, Users, AlertTriangle, CheckCircle2,
  Loader2, Shield, Zap, Activity, Database, Globe,
  Network, Server, FileCode2, Github, Mail, XCircle,
} from "lucide-react";

interface SecurityStats {
  scans: {
    total: number; today: number; this_month: number;
    running: number; failed: number; high_risk: number; avg_risk: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
  };
  ai: {
    messages_today: number; messages_this_month: number; cost_usd_this_month: number;
  };
  users: { total: number; active: number };
  system: { database: string; ai_api: string; payment: string; env: string };
  recent_scans: Array<{
    id: number; scan_type: string; target: string; status: string;
    risk_score: number; risk_level: string; created_at: string;
    user_email: string; user_name: string;
  }>;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  url: Globe, domain: Network, api: Server,
  file: FileCode2, github: Github, email: Mail,
};

const RISK_COLOR: Record<string, string> = {
  critical: "text-red-400", high: "text-orange-400",
  medium: "text-yellow-400", low: "text-green-400", unknown: "text-gray-400",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: "مكتمل",   color: "text-green-400" },
  running:   { label: "يعمل",    color: "text-blue-400" },
  queued:    { label: "انتظار",  color: "text-yellow-400" },
  failed:    { label: "فشل",     color: "text-red-400" },
};

function StatCard({
  icon: Icon, label, value, sub, color = "text-primary",
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color?: string;
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-2 rounded-lg bg-bg-dark ${color}`}><Icon size={16} /></div>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  const ok = status === "ok" || status === "configured";
  const mock = status === "mock_mode";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
      ok   ? "bg-green-500/10 text-green-400 border-green-500/30" :
      mock ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
             "bg-red-500/10 text-red-400 border-red-500/30"
    }`}>
      {ok ? "✓ " : mock ? "⚠ " : "✗ "}
      {status === "ok" ? "متصل" : status === "configured" ? "مُعدَّل" :
       status === "mock_mode" ? "وضع تجريبي" : status}
    </span>
  );
}

export default function SecurityCenter() {
  const { data, isLoading } = useQuery<SecurityStats>({
    queryKey: ["admin-security-stats"],
    queryFn: async () => (await adminApi.getSecurityStats()).data,
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-primary animate-spin" />
      </div>
    );
  }

  const { scans, ai, users, system, recent_scans } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">مركز الأمن</h1>
          <p className="text-text-muted text-sm mt-1">مراقبة المنصة لحظةً بلحظة</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Activity size={12} className="text-green-400 animate-pulse" />
          يتحدث كل 30 ث
        </div>
      </div>

      {/* System Health */}
      <div className="bg-bg-card border border-border rounded-2xl p-5">
        <h2 className="font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
          <Database size={14} className="text-primary" /> صحة النظام
        </h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">قاعدة البيانات</span>
            <HealthBadge status={system.database} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Anthropic AI</span>
            <HealthBadge status={system.ai_api} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">بوابة الدفع</span>
            <HealthBadge status={system.payment} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">البيئة</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-bg-dark text-text-muted border border-border capitalize">
              {system.env}
            </span>
          </div>
        </div>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={ScanLine}      label="فحوصات الشهر"   value={scans.this_month}       sub={`${scans.today} اليوم`} />
        <StatCard icon={AlertTriangle} label="فحوصات خطر عالٍ" value={scans.high_risk}       color="text-red-400"  sub={`متوسط المخاطر: ${scans.avg_risk}`} />
        <StatCard icon={Bot}           label="رسائل AI الشهر"  value={ai.messages_this_month} sub={`${ai.messages_today} اليوم`} color="text-blue-400" />
        <StatCard icon={Zap}           label="تكلفة AI الشهر"  value={`$${ai.cost_usd_this_month}`} sub="USD" color="text-yellow-400" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Users}         label="المستخدمون الفاعلون" value={users.active}    sub={`من ${users.total} إجمالاً`} />
        <StatCard icon={CheckCircle2}  label="فحوصات مكتملة"      value={scans.by_status["completed"] ?? 0} color="text-green-400" />
        <StatCard icon={Activity}      label="فحوصات جارية"        value={scans.running}   color="text-blue-400"  sub="الآن" />
        <StatCard icon={XCircle}       label="فحوصات فاشلة"        value={scans.failed}    color="text-red-400" />
      </div>

      {/* By Type breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Scan types */}
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
            <ScanLine size={14} className="text-primary" /> توزيع الفحوصات حسب النوع
          </h2>
          <div className="space-y-3">
            {Object.entries(scans.by_type).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const Icon = TYPE_ICONS[type] ?? Shield;
              const total = Object.values(scans.by_type).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <Icon size={12} />
                      <span>{type}</span>
                    </div>
                    <span className="text-text-primary font-medium">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-bg-dark rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(scans.by_type).length === 0 && (
              <p className="text-text-muted text-xs">لا توجد فحوصات بعد</p>
            )}
          </div>
        </div>

        {/* Status distribution */}
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
            <Activity size={14} className="text-primary" /> حالة الفحوصات الكلية
          </h2>
          <div className="space-y-3">
            {["completed", "failed", "running", "queued"].map(status => {
              const count = scans.by_status[status] ?? 0;
              const total = Object.values(scans.by_status).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-400" };
              const barColors: Record<string, string> = {
                completed: "bg-green-500", failed: "bg-red-500",
                running: "bg-blue-500", queued: "bg-yellow-500",
              };
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`${cfg.color}`}>{cfg.label}</span>
                    <span className="text-text-primary font-medium">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-bg-dark rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${barColors[status] ?? "bg-primary"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Scans */}
      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary text-sm flex items-center gap-2">
            <ScanLine size={14} className="text-primary" /> آخر الفحوصات (كل المستخدمين)
          </h2>
        </div>
        <div className="divide-y divide-border">
          {recent_scans.length === 0 && (
            <p className="text-text-muted text-sm text-center py-8">لا توجد فحوصات بعد</p>
          )}
          {recent_scans.map((scan) => {
            const Icon = TYPE_ICONS[scan.scan_type] ?? Shield;
            const rColor = RISK_COLOR[scan.risk_level] ?? "text-gray-400";
            const sCfg = STATUS_CONFIG[scan.status] ?? { label: scan.status, color: "text-gray-400" };
            return (
              <div key={scan.id} className="flex items-center gap-4 px-5 py-3 hover:bg-bg-dark/30">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm truncate">{scan.target}</p>
                  <p className="text-text-muted text-xs">{scan.user_email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-semibold ${rColor}`}>{scan.risk_score}</span>
                  <span className={`text-xs ${sCfg.color}`}>{sCfg.label}</span>
                  <span className="text-xs text-text-muted">
                    {new Date(scan.created_at).toLocaleDateString("ar-SA")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

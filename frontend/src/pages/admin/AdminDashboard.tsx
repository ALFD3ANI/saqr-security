import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import { Users, Clock, TrendingUp, ShieldAlert, Zap, ScanLine } from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardStats {
  users: { total: number; active: number; pending_approvals: number; new_today: number };
  plans: Record<string, number>;
  revenue: { mrr_sar: number; arr_sar: number };
  ai: { messages_today: number };
  scans: { this_month: number };
  recent_pending: Array<{
    id: number; full_name: string; email: string; plan: string;
    risk_score: number; risk_level: string; risk_flags: string; created_at: string;
  }>;
}

function StatCard({
  icon: Icon, label, value, sub, color = "text-primary",
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-bg-dark ${color}`}>
          <Icon size={18} />
        </div>
        <span className="text-sm text-text-muted">{label}</span>
      </div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low: "bg-green-500/20 text-green-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    high: "bg-orange-500/20 text-orange-400",
    critical: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[level] ?? "bg-bg-dark text-text-muted"}`}>
      {level}
    </span>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => (await adminApi.getStats()).data,
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-bg-card rounded-xl" />
        ))}
      </div>
    );
  }

  const planColors: Record<string, string> = {
    free: "bg-gray-500/20 text-gray-400",
    starter: "bg-blue-500/20 text-blue-400",
    professional: "bg-purple-500/20 text-purple-400",
    business: "bg-amber-500/20 text-amber-400",
    enterprise: "bg-primary/20 text-primary",
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Users}       label="Total Users"      value={data.users.total} />
        <StatCard icon={Users}       label="Active"           value={data.users.active}         color="text-green-400" />
        <StatCard icon={Clock}       label="Pending Approval" value={data.users.pending_approvals} color="text-yellow-400" />
        <StatCard icon={TrendingUp}  label="New Today"        value={data.users.new_today}      color="text-blue-400" />
        <StatCard icon={Zap}         label="AI Msgs Today"    value={data.ai.messages_today}    color="text-purple-400" />
        <StatCard icon={ScanLine}    label="Scans This Month" value={data.scans.this_month}     color="text-cyan-400" />
      </div>

      {/* Revenue + Plan Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" /> Revenue
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-text-muted text-sm">MRR</span>
              <span className="font-bold text-primary">{data.revenue.mrr_sar.toLocaleString()} SAR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted text-sm">ARR (est.)</span>
              <span className="font-bold text-green-400">{data.revenue.arr_sar.toLocaleString()} SAR</span>
            </div>
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-text-primary mb-4">Plan Distribution</h3>
          <div className="space-y-2">
            {Object.entries(data.plans).map(([plan, count]) => (
              <div key={plan} className="flex justify-between items-center">
                <span className={`text-xs px-2 py-0.5 rounded-full ${planColors[plan] ?? "bg-bg-dark text-text-muted"}`}>
                  {plan}
                </span>
                <span className="text-text-primary font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(data.plans).length === 0 && (
              <span className="text-text-muted text-sm">No active users yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Recent Pending Approvals */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-primary flex items-center gap-2">
            <ShieldAlert size={16} className="text-yellow-400" /> Recent Pending Approvals
          </h3>
          <Link to="/admin/approvals" className="text-xs text-primary hover:underline">
            View all →
          </Link>
        </div>

        {data.recent_pending.length === 0 ? (
          <p className="text-text-muted text-sm">No pending approvals</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left pb-2">Name</th>
                  <th className="text-left pb-2">Plan</th>
                  <th className="text-left pb-2">Risk</th>
                  <th className="text-left pb-2">Date</th>
                  <th className="text-left pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.recent_pending.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-bg-dark/50">
                    <td className="py-2">
                      <div className="font-medium text-text-primary">{r.full_name}</div>
                      <div className="text-xs text-text-muted">{r.email}</div>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${planColors[r.plan] ?? ""}`}>
                        {r.plan}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <RiskBadge level={r.risk_level} />
                        <span className="text-text-muted text-xs">{r.risk_score}</span>
                      </div>
                    </td>
                    <td className="py-2 text-text-muted text-xs">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <Link
                        to={`/admin/approvals`}
                        className="text-xs text-primary hover:underline"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

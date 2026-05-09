import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import { Search, UserX, UserCheck, Ban, ChevronLeft, ChevronRight } from "lucide-react";

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  company_name: string;
  role: string;
  status: string;
  plan: string;
  email_verified: boolean;
  totp_enabled: boolean;
  last_login_at: string | null;
  last_login_ip: string;
  plan_expires_at: string | null;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-500/20 text-green-400",
    pending_approval: "bg-yellow-500/20 text-yellow-400",
    suspended: "bg-orange-500/20 text-orange-400",
    banned: "bg-red-500/20 text-red-400",
    rejected: "bg-red-500/20 text-red-400",
    expired: "bg-gray-500/20 text-gray-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? "bg-bg-dark text-text-muted"}`}>
      {status}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    free: "text-gray-400",
    starter: "text-blue-400",
    professional: "text-purple-400",
    business: "text-amber-400",
    enterprise: "text-primary",
  };
  return (
    <span className={`text-xs font-medium ${map[plan] ?? "text-text-muted"}`}>
      {plan}
    </span>
  );
}

const PAGE_SIZE = 20;

export default function UserManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [actionPending, setActionPending] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, statusFilter, planFilter, offset],
    queryFn: async () =>
      (await adminApi.listUsers({
        search: search || undefined,
        status: statusFilter || undefined,
        plan: planFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      })).data,
    placeholderData: (prev) => prev,
  });

  const users: AdminUser[] = data?.users ?? [];
  const total: number = data?.total ?? 0;

  async function doAction(userId: number, action: "suspend" | "activate" | "ban") {
    setActionPending(userId);
    try {
      if (action === "suspend") await adminApi.suspendUser(userId);
      else if (action === "activate") await adminApi.activateUser(userId);
      else await adminApi.banUser(userId);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } finally {
      setActionPending(null);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">User Management</h1>
        <span className="text-text-muted text-sm">{total} users</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            placeholder="Search name, email, company..."
            className="w-full bg-bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="">All Status</option>
          {["active", "pending_approval", "suspended", "banned", "rejected", "expired"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setOffset(0); }}
          className="bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="">All Plans</option>
          {["free", "starter", "professional", "business", "enterprise"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-bg-card rounded-lg" />)}
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-text-muted">
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Last Login</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-bg-dark/40">
                  <td className="p-3">
                    <div className="font-medium text-text-primary">{u.full_name}</div>
                    <div className="text-xs text-text-muted">{u.email}</div>
                    {u.company_name && (
                      <div className="text-xs text-text-muted">{u.company_name}</div>
                    )}
                  </td>
                  <td className="p-3"><PlanBadge plan={u.plan} /></td>
                  <td className="p-3"><StatusBadge status={u.status} /></td>
                  <td className="p-3">
                    <span className={`text-xs ${u.role !== "user" ? "text-primary font-medium" : "text-text-muted"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 text-text-muted text-xs">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {u.status !== "active" && u.status !== "banned" && (
                        <button
                          onClick={() => doAction(u.id, "activate")}
                          disabled={actionPending === u.id}
                          title="Activate"
                          className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                        >
                          <UserCheck size={13} />
                        </button>
                      )}
                      {u.status === "active" && (
                        <button
                          onClick={() => doAction(u.id, "suspend")}
                          disabled={actionPending === u.id}
                          title="Suspend"
                          className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-50"
                        >
                          <UserX size={13} />
                        </button>
                      )}
                      {u.status !== "banned" && (
                        <button
                          onClick={() => {
                            if (confirm(`Ban ${u.email}?`)) doAction(u.id, "ban");
                          }}
                          disabled={actionPending === u.id}
                          title="Ban"
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Ban size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-sm">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="p-2 rounded-lg border border-border text-text-muted hover:text-text-primary disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="p-2 rounded-lg border border-border text-text-muted hover:text-text-primary disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

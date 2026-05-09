import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import { CheckCircle, XCircle, Eye, AlertTriangle } from "lucide-react";

interface ApprovalRequest {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  use_case: string;
  requested_plan: string;
  payment_amount: number;
  payment_status: string;
  ip_address: string;
  country: string;
  risk_score: number;
  risk_level: string;
  risk_flags: string;
  status: string;
  admin_notes: string;
  rejection_reason: string;
  created_at: string;
  approved_at: string | null;
}

function RiskBadge({ level, score }: { level: string; score: number }) {
  const map: Record<string, string> = {
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[level] ?? ""}`}>
      {level} ({score})
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400",
    approved: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? "bg-bg-dark text-text-muted"}`}>
      {status}
    </span>
  );
}

interface DecideModalProps {
  request: ApprovalRequest;
  onClose: () => void;
}

function DecideModal({ request, onClose }: DecideModalProps) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      adminApi.decide(request.id, decision, notes || undefined, rejectionReason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      onClose();
    },
  });

  const flags: string[] = (() => {
    try { return JSON.parse(request.risk_flags || "[]"); }
    catch { return []; }
  })();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary">Review Request #{request.id}</h2>

        {/* User info */}
        <div className="bg-bg-dark rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Name</span>
            <span className="text-text-primary font-medium">{request.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Email</span>
            <span className="text-text-primary">{request.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Company</span>
            <span className="text-text-primary">{request.company_name || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Plan</span>
            <span className="text-primary font-medium">{request.requested_plan}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Country</span>
            <span className="text-text-primary">{request.country || "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Risk</span>
            <RiskBadge level={request.risk_level} score={request.risk_score} />
          </div>
          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {flags.map((f) => (
                <span key={f} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          )}
          {request.use_case && (
            <div className="pt-1">
              <span className="text-text-muted block mb-1">Use Case</span>
              <p className="text-text-primary text-xs bg-bg-card rounded p-2">{request.use_case}</p>
            </div>
          )}
        </div>

        {/* Decision */}
        <div className="flex gap-2">
          <button
            onClick={() => setDecision("approve")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              decision === "approve"
                ? "bg-green-500/20 text-green-400 border-green-500/50"
                : "border-border text-text-muted hover:border-green-500/30"
            }`}
          >
            Approve
          </button>
          <button
            onClick={() => setDecision("reject")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              decision === "reject"
                ? "bg-red-500/20 text-red-400 border-red-500/50"
                : "border-border text-text-muted hover:border-red-500/30"
            }`}
          >
            Reject
          </button>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Admin notes (optional)"
          rows={2}
          className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary resize-none"
        />

        {decision === "reject" && (
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Rejection reason (shown to user)"
            rows={2}
            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-400 resize-none"
          />
        )}

        {mut.isError && (
          <p className="text-red-400 text-xs">Failed to submit decision. Please try again.</p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-text-muted text-sm hover:bg-bg-dark"
          >
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              decision === "approve"
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-red-500 hover:bg-red-600 text-white"
            } disabled:opacity-50`}
          >
            {mut.isPending ? "Submitting..." : decision === "approve" ? "Confirm Approve" : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalQueue() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-approvals", statusFilter],
    queryFn: async () => (await adminApi.listApprovals({ status: statusFilter, limit: 100 })).data,
  });

  const requests: ApprovalRequest[] = data?.requests ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Approval Queue</h1>
        <span className="text-text-muted text-sm">{data?.total ?? 0} total</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["pending", "approved", "rejected", "all"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === s
                ? "bg-primary text-bg-dark font-medium"
                : "bg-bg-card border border-border text-text-muted hover:text-text-primary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-bg-card rounded-xl" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
          <p>No {statusFilter} requests</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-text-muted">
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Risk</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-bg-dark/40">
                  <td className="p-3">
                    <div className="font-medium text-text-primary">{r.full_name}</div>
                    <div className="text-xs text-text-muted">{r.email}</div>
                    {r.company_name && (
                      <div className="text-xs text-text-muted">{r.company_name}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {r.requested_plan}
                    </span>
                  </td>
                  <td className="p-3">
                    <RiskBadge level={r.risk_level} score={r.risk_score} />
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3 text-text-muted text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {r.status === "pending" ? (
                      <button
                        onClick={() => setSelected(r)}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 bg-primary/10 px-2 py-1 rounded-lg"
                      >
                        <Eye size={12} /> Review
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted">
                        {r.status === "approved"
                          ? <span className="flex items-center gap-1 text-green-400"><CheckCircle size={12} /> Done</span>
                          : <span className="flex items-center gap-1 text-red-400"><XCircle size={12} /> Done</span>
                        }
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <DecideModal request={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

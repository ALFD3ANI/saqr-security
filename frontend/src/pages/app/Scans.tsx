import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { scansApi } from "@/services/api";
import {
  Plus, Globe, ShieldAlert,
  CheckCircle2, Clock, XCircle, Loader2, ChevronRight
} from "lucide-react";

interface Scan {
  id: number;
  scan_type: string;
  target: string;
  status: string;
  risk_score: number;
  risk_level: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  duration_ms: number | null;
  created_at: string;
}

function RiskBadge({ level, score }: { level: string; score: number }) {
  const map: Record<string, string> = {
    low:      "bg-green-500/15 text-green-400  border-green-500/30",
    medium:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    high:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
    critical: "bg-red-500/15  text-red-400   border-red-500/30",
    unknown:  "bg-gray-500/15  text-gray-400  border-gray-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[level] ?? map.unknown}`}>
      {level} {score > 0 ? `(${score})` : ""}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 size={16} className="text-green-400" />;
  if (status === "running")   return <Loader2 size={16} className="text-primary animate-spin" />;
  if (status === "queued")    return <Clock size={16} className="text-yellow-400" />;
  if (status === "failed")    return <XCircle size={16} className="text-red-400" />;
  return null;
}

export default function Scans() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["scans"],
    queryFn: async () => (await scansApi.list({ limit: 50 })).data,
    refetchInterval: (q) => {
      const scans: Scan[] = q.state.data?.scans ?? [];
      return scans.some(s => s.status === "running" || s.status === "queued") ? 2000 : false;
    },
  });

  const scans: Scan[] = data?.scans ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">الفحوصات</h1>
          <p className="text-text-muted text-sm mt-0.5">{total} فحص إجمالي</p>
        </div>
        <button
          onClick={() => navigate("/scans/new")}
          className="flex items-center gap-2 bg-primary text-bg-dark font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/90 text-sm"
        >
          <Plus size={16} /> فحص جديد
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-bg-card rounded-xl" />)}
        </div>
      ) : scans.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl p-16 text-center">
          <ShieldAlert size={40} className="mx-auto mb-4 text-text-muted opacity-40" />
          <h3 className="text-text-primary font-semibold mb-2">لا توجد فحوصات بعد</h3>
          <p className="text-text-muted text-sm mb-5">ابدأ أول فحص أمني لموقعك الإلكتروني</p>
          <button
            onClick={() => navigate("/scans/new")}
            className="bg-primary text-bg-dark font-semibold px-5 py-2.5 rounded-xl hover:bg-primary/90 text-sm"
          >
            ابدأ الفحص الأول
          </button>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          {scans.map((scan, idx) => (
            <div
              key={scan.id}
              className={`flex items-center gap-4 p-4 hover:bg-bg-dark/40 cursor-pointer transition-colors ${idx < scans.length - 1 ? "border-b border-border/50" : ""}`}
              onClick={() => navigate(`/scans/${scan.id}`)}
            >
              {/* Icon */}
              <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                <Globe size={18} className="text-primary" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <StatusIcon status={scan.status} />
                  <span className="text-text-primary font-medium text-sm truncate">{scan.target}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="capitalize">{scan.scan_type}</span>
                  <span>{new Date(scan.created_at).toLocaleDateString("ar-SA")}</span>
                  {scan.duration_ms && (
                    <span>{(scan.duration_ms / 1000).toFixed(1)}ث</span>
                  )}
                </div>
              </div>

              {/* Risk + counts */}
              {scan.status === "completed" && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex gap-1.5 text-xs">
                    {scan.critical_count > 0 && (
                      <span className="bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded">{scan.critical_count} C</span>
                    )}
                    {scan.high_count > 0 && (
                      <span className="bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded">{scan.high_count} H</span>
                    )}
                    {scan.medium_count > 0 && (
                      <span className="bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded">{scan.medium_count} M</span>
                    )}
                  </div>
                  <RiskBadge level={scan.risk_level} score={scan.risk_score} />
                </div>
              )}
              {scan.status === "running" && (
                <span className="text-xs text-primary">جاري الفحص...</span>
              )}
              {scan.status === "queued" && (
                <span className="text-xs text-yellow-400">في الانتظار</span>
              )}
              {scan.status === "failed" && (
                <span className="text-xs text-red-400">فشل</span>
              )}

              <ChevronRight size={14} className="text-text-muted shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

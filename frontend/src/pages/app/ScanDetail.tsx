import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scansApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowLeft, Globe, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronUp
} from "lucide-react";

interface Finding {
  severity: string;
  category: string;
  title: string;
  title_ar: string;
  description: string;
  recommendation: string;
  evidence?: string;
  cwe_id?: string;
  cvss_score?: number;
}

const SEV_CONFIG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  critical: { label: "حرجة",   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",    order: 0 },
  high:     { label: "عالية",  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", order: 1 },
  medium:   { label: "متوسطة", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", order: 2 },
  low:      { label: "منخفضة", color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30",   order: 3 },
  info:     { label: "معلومة", color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/30",   order: 4 },
};

function FindingCard({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false);
  const cfg = SEV_CONFIG[f.severity] ?? SEV_CONFIG.info;

  return (
    <div className={`border rounded-xl overflow-hidden ${cfg.bg}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-start gap-3 hover:bg-white/5"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className="text-text-primary text-sm font-medium truncate">{f.title_ar || f.title}</span>
          {f.cwe_id && (
            <span className="text-xs text-text-muted shrink-0">{f.cwe_id}</span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-text-muted shrink-0" /> : <ChevronDown size={14} className="text-text-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">الوصف</p>
            <p className="text-sm text-text-primary leading-relaxed">{f.description}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">التوصية</p>
            <p className="text-sm text-green-300 leading-relaxed">{f.recommendation}</p>
          </div>
          {f.evidence && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">الدليل</p>
              <pre className="text-xs text-text-muted bg-bg-dark rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                {f.evidence}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ progress, status }: { progress: number; status: string }) {
  const color = status === "failed" ? "bg-red-500" : status === "completed" ? "bg-green-500" : "bg-primary";
  return (
    <div className="w-full bg-bg-dark rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color} ${status === "running" ? "animate-pulse" : ""}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { accessToken } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<{ progress: number; message: string }>({ progress: 0, message: "" });
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["scan", id],
    queryFn: async () => (await scansApi.get(Number(id))).data,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "running" || s === "queued" ? 3000 : false;
    },
  });

  // WebSocket connection for live progress
  useEffect(() => {
    if (!id || !accessToken) return;
    if (data?.status === "completed" || data?.status === "failed") return;

    const wsUrl = `ws://localhost:8000/api/v1/scans/${id}/progress?token=${accessToken}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setWsStatus({ progress: msg.progress ?? 0, message: msg.message ?? "" });
        if (msg.status === "completed" || msg.status === "failed") {
          qc.invalidateQueries({ queryKey: ["scan", id] });
          ws.close();
        }
      } catch {}
    };

    return () => { ws.close(); };
  }, [id, accessToken, data?.status]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="text-primary animate-spin" />
      </div>
    );
  }

  const findings: Finding[] = data.findings ?? [];
  const summary = data.summary ?? {};
  const isRunning = data.status === "running" || data.status === "queued";

  const filtered = severityFilter === "all"
    ? findings
    : findings.filter(f => f.severity === severityFilter);

  const sorted = [...filtered].sort(
    (a, b) => (SEV_CONFIG[a.severity]?.order ?? 9) - (SEV_CONFIG[b.severity]?.order ?? 9)
  );

  const riskColor: Record<string, string> = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-yellow-400",
    low: "text-green-400",
    unknown: "text-gray-400",
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/scans")} className="p-2 rounded-lg hover:bg-bg-card text-text-muted">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-primary shrink-0" />
            <h1 className="text-lg font-bold text-text-primary truncate">{data.target}</h1>
          </div>
          <p className="text-text-muted text-xs mt-0.5">
            {new Date(data.created_at).toLocaleString("ar-SA")} · {data.scan_type}
          </p>
        </div>
      </div>

      {/* Progress (running) */}
      {isRunning && (
        <div className="bg-bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="text-primary animate-spin" />
            <span className="text-text-primary font-medium text-sm">
              {data.status === "queued" ? "الفحص في الانتظار..." : "جاري الفحص..."}
            </span>
          </div>
          <ProgressBar progress={wsStatus.progress || (data.status === "queued" ? 0 : 50)} status={data.status} />
          {wsStatus.message && (
            <p className="text-text-muted text-xs">{wsStatus.message}</p>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {data.status === "completed" && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-bg-card border border-border rounded-xl p-4 col-span-2 sm:col-span-1 flex flex-col items-center">
            <div className={`text-3xl font-bold ${riskColor[data.risk_level] ?? "text-gray-400"}`}>
              {data.risk_score}
            </div>
            <div className="text-xs text-text-muted mt-1">درجة الخطر</div>
            <div className={`text-xs font-medium mt-1 ${riskColor[data.risk_level] ?? "text-gray-400"}`}>
              {data.risk_level}
            </div>
          </div>
          {(["critical", "high", "medium", "low", "info"] as const).map((sev) => (
            <div key={sev} className="bg-bg-card border border-border rounded-xl p-4 flex flex-col items-center">
              <div className={`text-2xl font-bold ${SEV_CONFIG[sev].color}`}>
                {summary[sev] ?? 0}
              </div>
              <div className="text-xs text-text-muted mt-1">{SEV_CONFIG[sev].label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Failed */}
      {data.status === "failed" && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-start gap-3">
          <XCircle size={20} className="text-red-400 shrink-0" />
          <div>
            <p className="text-text-primary font-medium">فشل الفحص</p>
            <p className="text-text-muted text-sm mt-1">{data.error_msg || "خطأ غير معروف"}</p>
          </div>
        </div>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text-primary">
              النتائج ({findings.length})
            </h2>
            <div className="flex gap-1.5">
              {["all", "critical", "high", "medium", "low", "info"].map((sev) => {
                const count = sev === "all" ? findings.length : findings.filter(f => f.severity === sev).length;
                if (count === 0 && sev !== "all") return null;
                return (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                      severityFilter === sev
                        ? "bg-primary text-bg-dark font-medium"
                        : "bg-bg-card border border-border text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {sev === "all" ? "الكل" : SEV_CONFIG[sev]?.label} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            {sorted.map((f, i) => <FindingCard key={i} f={f} />)}
          </div>
        </div>
      )}

      {data.status === "completed" && findings.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
          <CheckCircle2 size={32} className="text-green-400 mx-auto mb-3" />
          <p className="text-text-primary font-semibold">لم يتم اكتشاف مشكلات خطيرة</p>
          <p className="text-text-muted text-sm mt-1">الموقع يبدو آمناً بناءً على الفحص المُجرى</p>
        </div>
      )}
    </div>
  );
}

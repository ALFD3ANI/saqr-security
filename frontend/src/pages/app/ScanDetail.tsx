import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scansApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { API_BASE, WS_ORIGIN } from "@/lib/config";
import {
  ArrowLeft, Globe, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp, Bot, Sparkles, Wrench, X, Swords,
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
  attack_scenario?: string;
}

const SEV_CONFIG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  critical: { label: "حرجة",   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",    order: 0 },
  high:     { label: "عالية",  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", order: 1 },
  medium:   { label: "متوسطة", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", order: 2 },
  low:      { label: "منخفضة", color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30",   order: 3 },
  info:     { label: "معلومة", color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/30",   order: 4 },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderMarkdown(text: string): string {
  const t = escapeHtml(text);
  return t
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-bg-dark rounded-lg p-3 text-xs overflow-x-auto my-2 whitespace-pre-wrap"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-bg-dark px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-text-primary mt-3 mb-1 text-sm">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-text-primary mt-4 mb-2 text-base">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-text-primary mt-4 mb-2 text-lg">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n/g, '<br>');
}

// Reusable SSE streaming helper
async function streamSSE(
  url: string,
  body: object,
  onText: (t: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem("access_token");
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data?.detail?.message ?? `HTTP ${resp.status}`);
  }
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const chunk = JSON.parse(line.slice(6));
        if (chunk.text) onText(chunk.text);
        if (chunk.done) onDone();
        if (chunk.error) throw new Error(chunk.error);
      } catch {}
    }
  }
}

// Fix Wizard inline panel
function FixWizardPanel({
  finding, onClose,
}: {
  finding: Finding; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    streamSSE(
      `${API_BASE}/ai/fix-wizard`,
      {
        finding_title: finding.title_ar || finding.title,
        finding_description: finding.description,
        evidence: finding.evidence ?? "",
      },
      (t) => setText(prev => prev + t),
      () => setDone(true),
      ctrl.signal,
    ).catch(e => {
      if (e.name !== "AbortError") setError(e.message);
    });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="mt-3 border-t border-primary/20 pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Wrench size={12} />
          <span>Fix Wizard — توصية الإصلاح</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={12} />
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : (
        <div className="text-sm text-text-primary leading-relaxed">
          <div
            className="prose-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
          />
          {!done && (
            <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse rounded-sm align-middle" />
          )}
        </div>
      )}
    </div>
  );
}

function FindingCard({
  f, onFixWizard, showFix,
}: {
  f: Finding; onFixWizard: () => void; showFix: boolean;
}) {
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

          {f.attack_scenario && (
            <div className="p-3 bg-red-500/8 border border-red-500/25 rounded-xl">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Swords size={12} className="text-red-400 shrink-0" />
                <p className="text-xs font-semibold text-red-400">كيف يستغلها المهاجم</p>
              </div>
              <p className="text-sm text-red-200/80 leading-relaxed">{f.attack_scenario}</p>
            </div>
          )}

          <div className="p-3 bg-green-500/8 border border-green-500/25 rounded-xl">
            <p className="text-xs font-semibold text-green-400 mb-1.5">طريقة الإصلاح</p>
            <p className="text-sm text-green-200/80 leading-relaxed">{f.recommendation}</p>
          </div>

          {f.evidence && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">الدليل</p>
              <pre className="text-xs text-text-muted bg-bg-dark rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                {f.evidence}
              </pre>
            </div>
          )}
          {f.cvss_score && (
            <p className="text-xs text-text-muted">CVSS: {f.cvss_score}</p>
          )}

          {/* Fix Wizard Button */}
          <div>
            <button
              onClick={(e) => { e.stopPropagation(); onFixWizard(); }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                showFix
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
              }`}
            >
              <Wrench size={11} />
              {showFix ? "إخفاء التوصية" : "إصلاح بالذكاء الاصطناعي"}
            </button>
          </div>

          {showFix && (
            <FixWizardPanel
              finding={f}
              onClose={onFixWizard}
            />
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
  const analyzeAbortRef = useRef<AbortController | null>(null);

  const [wsStatus, setWsStatus] = useState<{ progress: number; message: string }>({ progress: 0, message: "" });
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [fixWizardIndex, setFixWizardIndex] = useState<number | null>(null);

  // AI Analysis state
  const [aiText, setAiText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["scan", id],
    queryFn: async () => (await scansApi.get(Number(id))).data,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "running" || s === "queued" ? 3000 : false;
    },
  });

  // WebSocket for live progress
  useEffect(() => {
    if (!id || !accessToken) return;
    if (data?.status === "completed" || data?.status === "failed") return;

    const wsUrl = `${WS_ORIGIN}/api/v1/scans/${id}/progress?token=${accessToken}`;
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

  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing) {
      analyzeAbortRef.current?.abort();
      setIsAnalyzing(false);
      return;
    }
    setShowAnalysis(true);
    setAiText("");
    setAnalysisDone(false);
    setAnalysisError("");
    setIsAnalyzing(true);

    const ctrl = new AbortController();
    analyzeAbortRef.current = ctrl;

    try {
      await streamSSE(
        `${API_BASE}/ai/analyze-scan/${id}`,
        {},
        (t) => setAiText(prev => prev + t),
        () => { setAnalysisDone(true); setIsAnalyzing(false); },
        ctrl.signal,
      );
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setAnalysisError(e.message ?? "فشل التحليل");
        setIsAnalyzing(false);
      }
    }
  }, [id, isAnalyzing]);

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
    high:     "text-orange-400",
    medium:   "text-yellow-400",
    low:      "text-green-400",
    unknown:  "text-gray-400",
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
            <h1 className="text-lg font-bold text-text-primary truncate">{data.target_display || data.target}</h1>
          </div>
          <p className="text-text-muted text-xs mt-0.5">
            {new Date(data.created_at).toLocaleString("ar-SA")} · {data.scan_type}
          </p>
        </div>
        {data.status === "completed" && (
          <button
            onClick={handleAnalyze}
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl font-medium transition-colors ${
              isAnalyzing
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-primary text-bg-dark hover:bg-primary/90"
            }`}
          >
            {isAnalyzing ? (
              <><Loader2 size={13} className="animate-spin" /> إيقاف</>
            ) : (
              <><Sparkles size={13} /> تحليل AI</>
            )}
          </button>
        )}
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

      {/* AI Analysis Panel */}
      {showAnalysis && (
        <div className="bg-bg-card border border-primary/20 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <Bot size={15} className="text-primary" />
              <span className="text-sm font-semibold text-text-primary">التحليل الأمني بالذكاء الاصطناعي</span>
            </div>
            <button
              onClick={() => setShowAnalysis(false)}
              className="text-text-muted hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </div>
          <div className="p-4 text-sm leading-relaxed text-text-primary">
            {analysisError ? (
              <p className="text-red-400">{analysisError}</p>
            ) : (
              <>
                <div
                  className="prose-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(aiText) }}
                />
                {!analysisDone && (
                  <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm align-middle" />
                )}
                {!aiText && !analysisError && (
                  <div className="flex items-center gap-2 text-text-muted">
                    <Loader2 size={14} className="animate-spin" />
                    <span>يحلّل المساعد النتائج...</span>
                  </div>
                )}
              </>
            )}
          </div>
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
            <div className="flex gap-1.5 flex-wrap">
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
            {sorted.map((f, i) => (
              <FindingCard
                key={i}
                f={f}
                showFix={fixWizardIndex === i}
                onFixWizard={() => setFixWizardIndex(prev => prev === i ? null : i)}
              />
            ))}
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

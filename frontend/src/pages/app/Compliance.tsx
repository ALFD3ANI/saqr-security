import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api, { scansApi } from "@/services/api";
import { API_BASE } from "@/lib/config";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Minus,
  ChevronDown, ChevronUp, Bot, Sparkles, Loader2, X,
  Globe, Network, Server, FileCode2, Github, Mail,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

interface ComplianceItem {
  id: string;
  domain: string;
  domain_ar: string;
  title_ar: string;
  description_ar: string;
  priority: string;
  status: string;
  findings: string[];
}

interface FrameworkReport {
  framework: string;
  name_ar: string;
  score: number;
  total: number;
  compliant: number;
  non_compliant: number;
  partial: number;
  not_assessed: number;
  items: ComplianceItem[];
}

interface ComplianceData {
  scan_id: number;
  scan_type: string;
  target: string;
  overall_score: number;
  frameworks: {
    nca_ecc:  FrameworkReport;
    sama_csf: FrameworkReport;
    pdpl:     FrameworkReport;
  };
}

interface Scan {
  id: number;
  scan_type: string;
  target: string;
  target_display?: string;
  status: string;
  risk_score: number;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ElementType> = {
  url: Globe, domain: Network, api: Server,
  file: FileCode2, github: Github, email: Mail,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  compliant:     { label: "ممتثل",       color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30",  icon: CheckCircle2 },
  non_compliant: { label: "غير ممتثل",   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",      icon: XCircle },
  partial:       { label: "جزئي",        color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: AlertTriangle },
  not_assessed:  { label: "غير مقيَّم",  color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/30",    icon: Minus },
};

const PRIORITY_CONFIG: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-yellow-400",
  low:      "text-blue-400",
};

const FW_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  nca_ecc:  { ring: "#6366f1", text: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/30" },
  sama_csf: { ring: "#10b981", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  pdpl:     { ring: "#f59e0b", text: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30" },
};

function renderMarkdown(text: string): string {
  return text
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

// ── Score Ring ─────────────────────────────────────────────────

function ScoreRing({ score, color, size = 80 }: { score: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1e2e" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

// ── Framework Card ─────────────────────────────────────────────

function FrameworkCard({
  fw, report, active, onClick,
}: {
  fw: string; report: FrameworkReport; active: boolean; onClick: () => void;
}) {
  const col = FW_COLORS[fw] ?? FW_COLORS.nca_ecc;
  const scoreColor = report.score >= 80 ? "#10b981" : report.score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <button
      onClick={onClick}
      className={`relative w-full bg-bg-card border rounded-2xl p-5 text-start transition-all ${
        active ? `border-primary/40 shadow-lg shadow-primary/5` : "border-border hover:border-primary/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold mb-1 ${col.text}`}>{fw.toUpperCase()}</p>
          <p className="text-text-primary font-semibold text-sm leading-snug">{report.name_ar}</p>
          <div className="flex gap-3 mt-3 text-xs">
            <span className="text-green-400">{report.compliant} ممتثل</span>
            <span className="text-red-400">{report.non_compliant} فجوة</span>
            <span className="text-yellow-400">{report.partial} جزئي</span>
          </div>
        </div>
        <div className="relative shrink-0">
          <ScoreRing score={report.score} color={scoreColor} size={64} />
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-text-primary rotate-90">
            {report.score}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Requirement Item ────────────────────────────────────────────

function RequirementItem({ item }: { item: ComplianceItem }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.not_assessed;
  const Icon = cfg.icon;

  return (
    <div className={`border rounded-xl overflow-hidden ${cfg.bg}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3.5 text-start hover:bg-white/5"
      >
        <Icon size={14} className={`shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted font-mono">{item.id}</span>
            <span className="text-text-muted text-xs">·</span>
            <span className={`text-xs font-medium ${PRIORITY_CONFIG[item.priority] ?? ""}`}>
              {item.priority}
            </span>
          </div>
          <p className="text-text-primary text-sm font-medium mt-0.5">{item.title_ar}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
        {open ? <ChevronUp size={13} className="text-text-muted shrink-0" /> : <ChevronDown size={13} className="text-text-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-white/5">
          <p className="text-sm text-text-primary">{item.description_ar}</p>
          {item.findings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">النتائج المرتبطة:</p>
              <ul className="space-y-1">
                {item.findings.map((f, i) => (
                  <li key={i} className="text-xs text-text-muted flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5 shrink-0">▸</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI Analysis Panel ───────────────────────────────────────────

function AIPanel({ scanId, onClose }: { scanId: number; onClose: () => void }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    streamSSE(
      `${API_BASE}/compliance/ai-analysis/${scanId}`,
      {},
      (t) => setText(prev => prev + t),
      () => setDone(true),
      ctrl.signal,
    ).catch(e => {
      if (e.name !== "AbortError") setError(e.message ?? "فشل التحليل");
    });
    return () => ctrl.abort();
  }, [scanId]);

  return (
    <div className="bg-bg-card border border-primary/20 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-primary" />
          <span className="text-sm font-semibold text-text-primary">تحليل فجوات الامتثال</span>
        </div>
        <div className="flex items-center gap-2">
          {!done && !error && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              إيقاف
            </button>
          )}
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="p-4 text-sm leading-relaxed text-text-primary max-h-96 overflow-y-auto">
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : !text ? (
          <div className="flex items-center gap-2 text-text-muted py-6 justify-center">
            <Loader2 size={16} className="animate-spin" />
            <span>يحلّل المساعد فجوات الامتثال...</span>
          </div>
        ) : (
          <>
            <div className="prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
            {!done && (
              <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm align-middle" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function Compliance() {
  const navigate = useNavigate();
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [activeFramework, setActiveFramework] = useState<"nca_ecc" | "sama_csf" | "pdpl">("nca_ecc");
  const [domainFilter, setDomainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAI, setShowAI] = useState(false);

  // Load completed scans
  const { data: scansData } = useQuery({
    queryKey: ["compliance-scans"],
    queryFn: async () => {
      const res = await scansApi.list({ status: "completed", limit: 50 });
      return res.data.scans as Scan[];
    },
  });

  const scans = scansData ?? [];

  // Auto-select first scan
  useEffect(() => {
    if (scans.length > 0 && !selectedScanId) {
      setSelectedScanId(scans[0].id);
    }
  }, [scans, selectedScanId]);

  // Load compliance data for selected scan
  const { data: complianceData, isLoading } = useQuery<ComplianceData>({
    queryKey: ["compliance", selectedScanId],
    queryFn: async () => (await api.get(`/compliance/scan/${selectedScanId}`)).data,
    enabled: !!selectedScanId,
  });

  const report = complianceData?.frameworks[activeFramework];
  const fw = FW_COLORS[activeFramework] ?? FW_COLORS.nca_ecc;

  // Group requirement domains for filter
  const domains = report
    ? ["all", ...Array.from(new Set(report.items.map(i => i.domain_ar)))]
    : ["all"];

  const filteredItems = (report?.items ?? []).filter(item => {
    const domainOk = domainFilter === "all" || item.domain_ar === domainFilter;
    const statusOk = statusFilter === "all" || item.status === statusFilter;
    return domainOk && statusOk;
  });

  const sorted = [...filteredItems].sort((a, b) => {
    const order = { non_compliant: 0, partial: 1, compliant: 2, not_assessed: 3 };
    return (order[a.status as keyof typeof order] ?? 9) - (order[b.status as keyof typeof order] ?? 9);
  });

  const overallScore = complianceData?.overall_score ?? 0;
  const scoreColor = overallScore >= 80 ? "text-green-400" : overallScore >= 60 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">لوحة الامتثال التنظيمي</h1>
          <p className="text-text-muted text-sm mt-1">
            NCA ECC · SAMA CSF · PDPL — تحليل تلقائي من نتائج الفحص
          </p>
        </div>
        {complianceData && (
          <button
            onClick={() => setShowAI(!showAI)}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium transition-colors ${
              showAI
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-primary text-bg-dark hover:bg-primary/90"
            }`}
          >
            <Sparkles size={14} />
            تحليل AI
          </button>
        )}
      </div>

      {/* Scan Selector */}
      <div className="bg-bg-card border border-border rounded-2xl p-4">
        <label className="text-xs font-medium text-text-muted mb-2 block">اختر الفحص للتحليل</label>
        {scans.length === 0 ? (
          <div className="text-text-muted text-sm py-2">
            لا توجد فحوصات مكتملة.{" "}
            <button onClick={() => navigate("/scans/new")} className="text-primary hover:underline">
              ابدأ فحصاً جديداً
            </button>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {scans.map((s) => {
              const Icon = TYPE_ICONS[s.scan_type] ?? Globe;
              return (
                <button
                  key={s.id}
                  onClick={() => { setSelectedScanId(s.id); setShowAI(false); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                    selectedScanId === s.id
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-bg-dark border border-border text-text-muted hover:text-text-primary hover:border-primary/20"
                  }`}
                >
                  <Icon size={12} />
                  <span className="max-w-[140px] truncate">{s.target_display || s.target}</span>
                  <span className="text-text-muted">({s.scan_type})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={28} className="text-primary animate-spin" />
        </div>
      )}

      {complianceData && (
        <>
          {/* AI Panel */}
          {showAI && (
            <AIPanel scanId={complianceData.scan_id} onClose={() => setShowAI(false)} />
          )}

          {/* Overall Score */}
          <div className="bg-bg-card border border-border rounded-2xl p-5 flex items-center gap-5">
            <div className="relative">
              <ScoreRing
                score={overallScore}
                color={overallScore >= 80 ? "#10b981" : overallScore >= 60 ? "#f59e0b" : "#ef4444"}
                size={88}
              />
              <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${scoreColor} rotate-90`}>
                {overallScore}
              </span>
            </div>
            <div>
              <p className="text-text-muted text-xs mb-1">درجة الامتثال الإجمالية</p>
              <p className={`text-2xl font-bold ${scoreColor}`}>
                {overallScore >= 80 ? "امتثال جيد" : overallScore >= 60 ? "امتثال متوسط" : "يحتاج تحسيناً عاجلاً"}
              </p>
              <p className="text-text-muted text-xs mt-1">
                الهدف: {complianceData.target} · {complianceData.scan_type}
              </p>
            </div>
          </div>

          {/* Framework Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["nca_ecc", "sama_csf", "pdpl"] as const).map((fw_key) => (
              <FrameworkCard
                key={fw_key}
                fw={fw_key}
                report={complianceData.frameworks[fw_key]}
                active={activeFramework === fw_key}
                onClick={() => {
                  setActiveFramework(fw_key);
                  setDomainFilter("all");
                  setStatusFilter("all");
                }}
              />
            ))}
          </div>

          {/* Requirements Detail */}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className={`font-bold text-base ${fw.text}`}>{report.name_ar}</h2>
                  <p className="text-text-muted text-xs mt-0.5">
                    {report.total} متطلب · {report.non_compliant} فجوة · {report.partial} جزئي
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* Status filter */}
                  {["all", "non_compliant", "partial", "compliant", "not_assessed"].map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                        statusFilter === s
                          ? "bg-primary text-bg-dark font-medium"
                          : "bg-bg-card border border-border text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {s === "all" ? "الكل" : STATUS_CONFIG[s]?.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Domain filter pills */}
              {domains.length > 2 && (
                <div className="flex gap-2 flex-wrap">
                  {domains.map(d => (
                    <button
                      key={d}
                      onClick={() => setDomainFilter(d)}
                      className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                        domainFilter === d
                          ? `${fw.bg} border font-medium`
                          : "bg-bg-dark border border-border text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {d === "all" ? "كل المجالات" : d}
                    </button>
                  ))}
                </div>
              )}

              {/* Items */}
              <div className="space-y-2">
                {sorted.map(item => (
                  <RequirementItem key={item.id} item={item} />
                ))}
                {sorted.length === 0 && (
                  <p className="text-text-muted text-sm text-center py-6">
                    لا توجد متطلبات تطابق الفلتر المحدد
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state - no scan selected */}
      {!isLoading && !complianceData && scans.length > 0 && (
        <div className="bg-bg-card border border-border rounded-2xl p-12 text-center">
          <Shield size={40} className="text-text-muted mx-auto mb-4" />
          <p className="text-text-primary font-semibold">اختر فحصاً لعرض تحليل الامتثال</p>
        </div>
      )}
    </div>
  );
}

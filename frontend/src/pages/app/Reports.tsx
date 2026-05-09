import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { scansApi } from "@/services/api";
import {
  FileText, Bot, ExternalLink, Loader2, Sparkles,
  Globe, Network, Server, FileCode2, Github, Mail, X,
  Shield, AlertTriangle, Info,
} from "lucide-react";

interface Scan {
  id: number;
  scan_type: string;
  target: string;
  target_display?: string;
  status: string;
  risk_score: number;
  risk_level: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  created_at: string;
  completed_at?: string;
  duration_ms?: number;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  url:    Globe,
  domain: Network,
  api:    Server,
  file:   FileCode2,
  github: Github,
  email:  Mail,
};

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "حرجة",   color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30" },
  high:     { label: "عالية",  color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  medium:   { label: "متوسطة", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  low:      { label: "منخفضة", color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30" },
  unknown:  { label: "غير محدد", color: "text-gray-400",  bg: "bg-gray-500/10",   border: "border-gray-500/30" },
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

function AIReportModal({ scan, onClose }: { scan: Scan; onClose: () => void }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const startAnalysis = useCallback(() => {
    setText("");
    setDone(false);
    setError("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    streamSSE(
      `/api/v1/ai/analyze-scan/${scan.id}`,
      {},
      (t) => setText(prev => prev + t),
      () => setDone(true),
      ctrl.signal,
    ).catch(e => {
      if (e.name !== "AbortError") setError(e.message ?? "فشل التحليل");
    });
  }, [scan.id]);

  // Auto-start on mount
  useEffect(() => { startAnalysis(); }, []);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html lang="ar" dir="rtl">
      <head><meta charset="UTF-8"><title>تقرير أمني - ${scan.target_display || scan.target}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 40px; color: #1a1a2e; direction: rtl; }
        h1 { color: #6366f1; } h2 { border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px; }
        .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
        .risk { font-weight: bold; font-size: 20px; }
        .counts { display: flex; gap: 16px; margin: 16px 0; }
        .count-item { text-align: center; padding: 12px 20px; border-radius: 8px; background: #f9fafb; border: 1px solid #e5e7eb; }
        .count-num { font-size: 24px; font-weight: bold; }
        pre { background: #f3f4f6; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 13px; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
        li { margin-bottom: 4px; }
        @media print { body { margin: 20px; } }
      </style></head>
      <body>
        <h1>تقرير أمني — Saqr Security</h1>
        <div class="meta">
          <strong>الهدف:</strong> ${scan.target_display || scan.target}<br>
          <strong>نوع الفحص:</strong> ${scan.scan_type}<br>
          <strong>التاريخ:</strong> ${new Date(scan.created_at).toLocaleString("ar-SA")}<br>
          <strong>درجة الخطر:</strong> <span class="risk">${scan.risk_score}/100 (${scan.risk_level})</span>
        </div>
        <div class="counts">
          <div class="count-item"><div class="count-num" style="color:#ef4444">${scan.critical_count}</div><div>حرجة</div></div>
          <div class="count-item"><div class="count-num" style="color:#f97316">${scan.high_count}</div><div>عالية</div></div>
          <div class="count-item"><div class="count-num" style="color:#eab308">${scan.medium_count}</div><div>متوسطة</div></div>
          <div class="count-item"><div class="count-num" style="color:#22c55e">${scan.low_count}</div><div>منخفضة</div></div>
          <div class="count-item"><div class="count-num" style="color:#6b7280">${scan.info_count}</div><div>معلومات</div></div>
        </div>
        <h2>التحليل الأمني بالذكاء الاصطناعي</h2>
        <div>${text ? renderMarkdown(text) : "<p>لم يتم توليد التحليل بعد</p>"}</div>
        <hr style="margin-top: 40px"><p style="color:#9ca3af;font-size:12px;text-align:center">تم توليده بواسطة Saqr Security · ${new Date().toLocaleString("ar-SA")}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-primary" />
            <span className="font-semibold text-text-primary text-sm">
              تقرير AI — {scan.target_display || scan.target}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {done && (
              <button
                onClick={handlePrint}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
              >
                طباعة / PDF
              </button>
            )}
            {!done && text && (
              <button
                onClick={() => abortRef.current?.abort()}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
              >
                إيقاف
              </button>
            )}
            <button onClick={onClose} className="text-text-muted hover:text-text-primary">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-text-primary">
          {error ? (
            <p className="text-red-400">{error}</p>
          ) : !text ? (
            <div className="flex items-center gap-2 text-text-muted py-8 justify-center">
              <Loader2 size={16} className="animate-spin" />
              <span>يحلّل المساعد نتائج الفحص...</span>
            </div>
          ) : (
            <>
              <div
                className="prose-sm"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
              />
              {!done && (
                <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm align-middle" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ scan, onAnalyze }: { scan: Scan; onAnalyze: () => void }) {
  const navigate = useNavigate();
  const Icon = TYPE_ICONS[scan.scan_type] ?? FileText;
  const rcfg = RISK_CONFIG[scan.risk_level] ?? RISK_CONFIG.unknown;

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-5 hover:border-primary/20 transition-colors">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon size={16} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-text-primary font-semibold text-sm truncate">
              {scan.target_display || scan.target}
            </p>
            <p className="text-text-muted text-xs mt-0.5">
              {scan.scan_type} · {new Date(scan.created_at).toLocaleDateString("ar-SA")}
            </p>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${rcfg.bg} ${rcfg.color} ${rcfg.border}`}>
          {rcfg.label} ({scan.risk_score})
        </div>
      </div>

      {/* Counts row */}
      <div className="flex gap-3 mb-4">
        {scan.critical_count > 0 && (
          <div className="flex items-center gap-1 text-red-400 text-xs">
            <AlertTriangle size={11} />
            <span>{scan.critical_count} حرجة</span>
          </div>
        )}
        {scan.high_count > 0 && (
          <div className="flex items-center gap-1 text-orange-400 text-xs">
            <Shield size={11} />
            <span>{scan.high_count} عالية</span>
          </div>
        )}
        {scan.medium_count > 0 && (
          <div className="flex items-center gap-1 text-yellow-400 text-xs">
            <Shield size={11} />
            <span>{scan.medium_count} متوسطة</span>
          </div>
        )}
        {scan.low_count + scan.info_count > 0 && (
          <div className="flex items-center gap-1 text-text-muted text-xs">
            <Info size={11} />
            <span>{scan.low_count + scan.info_count} أخرى</span>
          </div>
        )}
        {scan.total_findings === 0 && (
          <span className="text-green-400 text-xs">لا توجد مشكلات</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/scans/${scan.id}`)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-bg-dark border border-border text-text-muted hover:text-text-primary hover:border-primary/30 transition-colors"
        >
          <ExternalLink size={11} />
          عرض التفاصيل
        </button>
        <button
          onClick={onAnalyze}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
        >
          <Sparkles size={11} />
          تقرير AI
        </button>
      </div>
    </div>
  );
}

export default function Reports() {
  const [activeScan, setActiveScan] = useState<Scan | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reports-scans"],
    queryFn: async () => {
      const res = await scansApi.list({ status: "completed", limit: 50 });
      return res.data.scans as Scan[];
    },
  });

  const scans = data ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">التقارير الأمنية</h1>
          <p className="text-text-muted text-sm mt-1">
            عرض وتحليل نتائج الفحوصات المكتملة بالذكاء الاصطناعي
          </p>
        </div>
        <div className="flex items-center gap-2 bg-bg-card border border-border rounded-xl px-3 py-2">
          <FileText size={14} className="text-primary" />
          <span className="text-text-primary text-sm font-medium">{scans.length} تقرير</span>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="text-primary animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && scans.length === 0 && (
        <div className="bg-bg-card border border-border rounded-2xl p-12 text-center">
          <FileText size={36} className="text-text-muted mx-auto mb-4" />
          <p className="text-text-primary font-semibold">لا توجد تقارير بعد</p>
          <p className="text-text-muted text-sm mt-2">
            أجرِ فحصاً أمنياً من صفحة الفحوصات لتظهر التقارير هنا
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && scans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scans.map((scan) => (
            <ReportCard
              key={scan.id}
              scan={scan}
              onAnalyze={() => setActiveScan(scan)}
            />
          ))}
        </div>
      )}

      {/* AI Report Modal */}
      {activeScan && (
        <AIReportModal
          scan={activeScan}
          onClose={() => setActiveScan(null)}
        />
      )}
    </div>
  );
}

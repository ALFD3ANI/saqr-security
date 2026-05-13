import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import api, { scansApi } from "@/services/api";
import { API_BASE } from "@/lib/config";
import {
  Globe, ArrowLeft, Shield, FileCode2, Server, Github,
  Mail, Network, Upload, X, AlertTriangle, Loader2,
} from "lucide-react";

interface ScanTypeConfig {
  type: string;
  icon: React.ElementType;
  label: string;
  description: string;
  placeholder: string;
  color: string;
  isFile?: boolean;
  hasExtra?: { label: string; placeholder: string };
}

const SCAN_TYPES: ScanTypeConfig[] = [
  {
    type: "url",
    icon: Globe,
    label: "موقع إلكتروني (URL)",
    description: "SSL، Security Headers، المحتوى، الملفات الحساسة",
    placeholder: "https://example.com",
    color: "border-primary/50 bg-primary/5",
  },
  {
    type: "domain",
    icon: Network,
    label: "نطاق (Domain)",
    description: "DNS، SPF، DMARC، Subdomains، Open Ports",
    placeholder: "example.com",
    color: "border-blue-500/50 bg-blue-500/5",
  },
  {
    type: "api",
    icon: Server,
    label: "REST API",
    description: "CORS، Authentication، Rate Limiting، Data Leakage",
    placeholder: "https://api.example.com",
    color: "border-cyan-500/50 bg-cyan-500/5",
    hasExtra: { label: "Authorization Header (اختياري)", placeholder: "Bearer eyJhbGci..." },
  },
  {
    type: "file",
    icon: FileCode2,
    label: "ملف كود",
    description: "Python، JS، PHP، Java — بحث عن أسرار وثغرات",
    placeholder: "",
    color: "border-purple-500/50 bg-purple-500/5",
    isFile: true,
  },
  {
    type: "github",
    icon: Github,
    label: "GitHub Repository",
    description: "Secrets، Sensitive Files، Vulnerable Dependencies",
    placeholder: "https://github.com/owner/repo  أو  owner/repo",
    color: "border-gray-500/50 bg-gray-500/5",
  },
  {
    type: "email",
    icon: Mail,
    label: "أمان البريد الإلكتروني",
    description: "SPF، DMARC، DKIM، MX Records، Email Spoofing",
    placeholder: "example.com  أو  user@example.com",
    color: "border-amber-500/50 bg-amber-500/5",
  },
];

/**
 * 1. Ping /health to wake the Railway backend from sleep
 * 2. Call /auth/me via axios — if token expired the interceptor auto-refreshes it,
 *    if refresh also fails it redirects to /login before the scan request fires
 */
async function warmUpBackend(): Promise<void> {
  try {
    await fetch(`${API_BASE}/health`, { method: "GET", signal: AbortSignal.timeout(30_000) });
  } catch { /* ignore */ }
  try {
    await api.get("/auth/me");
  } catch { /* interceptor handles 401 → refresh or redirect */ }
}

export default function NewScan() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState("url");
  const [target, setTarget] = useState("");
  const [extra, setExtra] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const config = SCAN_TYPES.find(s => s.type === selectedType)!;

  const mut = useMutation({
    mutationFn: async () => {
      // Wake up the backend first (handles Railway cold-start)
      setStatusMsg("جاري التحقق من الخادم...");
      await warmUpBackend();
      setStatusMsg("جاري إنشاء الفحص...");

      if (config.isFile) {
        if (!file) throw new Error("يرجى اختيار ملف");
        const res = await scansApi.upload(file);
        return res;
      }
      return scansApi.create(selectedType, target.trim(), extra.trim() || undefined);
    },
    onSuccess: (res) => navigate(`/scans/${res.data.scan_id}`),
    onError: (e: any) => {
      setStatusMsg("");
      if (e.isAuthRedirect) return;
      if (e.isNetworkError) {
        setError("لا يمكن الوصول للخادم — تحقق من اتصالك أو حاول لاحقاً");
      } else if (e.code === "ECONNABORTED" || e.message?.includes("timeout")) {
        setError("الخادم يستغرق وقتاً أطول من المعتاد — حاول مرة أخرى");
      } else if (e.response?.status === 429) {
        setError(e.response?.data?.detail?.message ?? "وصلت لحد الفحوصات المسموح — رقّ خطتك للمزيد");
      } else if (e.response?.status === 403) {
        setError(e.response?.data?.detail?.message ?? "حسابك غير مفعّل أو لا يملك صلاحية الفحص");
      } else {
        setError(e.response?.data?.detail?.message ?? e.message ?? "حدث خطأ أثناء إنشاء الفحص");
      }
    },
    onSettled: () => setStatusMsg(""),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (config.isFile) {
      if (!file) { setError("يرجى اختيار ملف"); return; }
    } else {
      if (!target.trim()) { setError("يرجى إدخال الهدف"); return; }
    }
    mut.mutate();
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setTarget("");
    setExtra("");
    setFile(null);
    setError("");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/scans")}
          className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text-primary">فحص جديد</h1>
          <p className="text-text-muted text-sm">6 أنواع فحص متاحة</p>
        </div>
      </div>

      {/* Scan Type Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {SCAN_TYPES.map((st) => {
          const Icon = st.icon;
          const active = selectedType === st.type;
          return (
            <button
              key={st.type}
              onClick={() => handleTypeChange(st.type)}
              className={`text-start p-3.5 rounded-xl border-2 transition-all ${
                active ? st.color : "border-border hover:border-primary/30 bg-bg-card"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={15} className={active ? "text-primary" : "text-text-muted"} />
                <span className={`text-xs font-semibold leading-tight ${active ? "text-text-primary" : "text-text-muted"}`}>
                  {st.label}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{st.description}</p>
            </button>
          );
        })}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="bg-bg-card border border-border rounded-2xl p-6 space-y-4">

        {config.isFile ? (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              اختر ملف كود للفحص
            </label>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".py,.js,.ts,.jsx,.tsx,.php,.java,.html,.htm,.env,.yml,.yaml,.json,.sh,.rb,.go,.mjs,.cs,.cpp,.c,.h"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); }}
            />
            {file ? (
              <div className="flex items-center gap-3 p-3 bg-bg-dark border border-border rounded-xl">
                <FileCode2 size={16} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-medium truncate">{file.name}</p>
                  <p className="text-text-muted text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="p-1 hover:bg-bg-card rounded text-text-muted hover:text-red-400"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center transition-colors group"
              >
                <Upload size={24} className="text-text-muted group-hover:text-primary mx-auto mb-2" />
                <p className="text-text-muted text-sm">اسحب ملفاً هنا أو اضغط للاختيار</p>
                <p className="text-text-muted text-xs mt-1">
                  .py .js .ts .php .java .html .env .json .yml — حتى 5MB
                </p>
              </button>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">الهدف</label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={config.placeholder}
              className="w-full bg-bg-dark border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary text-sm"
              dir="ltr"
            />
          </div>
        )}

        {config.hasExtra && (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {config.hasExtra.label}
            </label>
            <input
              type="text"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={config.hasExtra.placeholder}
              className="w-full bg-bg-dark border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary text-sm"
              dir="ltr"
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <div className="flex gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <Shield size={14} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted">
            يُجرى الفحص بشكل آمن ومسؤول. لا تفحص إلا أهدافاً تملكها أو لديك تصريح صريح بفحصها.
          </p>
        </div>

        <button
          type="submit"
          disabled={mut.isPending || (!config.isFile && !target.trim()) || (config.isFile && !file)}
          className="w-full bg-primary text-bg-dark font-semibold py-3 rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors flex items-center justify-center gap-2"
        >
          {mut.isPending ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {statusMsg || "جاري إنشاء الفحص..."}
            </>
          ) : "ابدأ الفحص"}
        </button>
      </form>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { scansApi } from "@/services/api";
import { Globe, ArrowLeft, Shield } from "lucide-react";

const SCAN_TYPES = [
  {
    type: "url",
    icon: Globe,
    label: "URL / موقع إلكتروني",
    labelEn: "URL / Website",
    description: "فحص شامل للموقع: SSL، Security Headers، المحتوى، الملفات الحساسة",
    placeholder: "https://example.com",
    color: "border-primary/50 bg-primary/5",
  },
  {
    type: "domain",
    icon: Globe,
    label: "نطاق (Domain)",
    labelEn: "Domain",
    description: "فحص النطاق: DNS، Subdomains، Open Ports",
    placeholder: "example.com",
    color: "border-blue-500/50 bg-blue-500/5",
  },
];

export default function NewScan() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState("url");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => scansApi.create(selectedType, target.trim()),
    onSuccess: (res) => {
      navigate(`/scans/${res.data.scan_id}`);
    },
    onError: (e: any) => {
      setError(e.response?.data?.detail?.message ?? "حدث خطأ أثناء إنشاء الفحص");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!target.trim()) { setError("يرجى إدخال الهدف"); return; }
    mut.mutate();
  };

  const selected = SCAN_TYPES.find(s => s.type === selectedType)!;

  return (
    <div className="max-w-xl mx-auto space-y-6">
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
          <p className="text-text-muted text-sm">اختر نوع الفحص وأدخل الهدف</p>
        </div>
      </div>

      {/* Scan Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SCAN_TYPES.map((st) => {
          const Icon = st.icon;
          return (
            <button
              key={st.type}
              onClick={() => { setSelectedType(st.type); setTarget(""); setError(""); }}
              className={`text-start p-4 rounded-xl border-2 transition-all ${
                selectedType === st.type
                  ? st.color + " border-opacity-100"
                  : "border-border hover:border-primary/30 bg-bg-card"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className={selectedType === st.type ? "text-primary" : "text-text-muted"} />
                <span className={`text-sm font-semibold ${selectedType === st.type ? "text-text-primary" : "text-text-muted"}`}>
                  {st.label}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">{st.description}</p>
            </button>
          );
        })}
      </div>

      {/* Target Input */}
      <form onSubmit={handleSubmit} className="bg-bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            الهدف
          </label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={selected.placeholder}
            className="w-full bg-bg-dark border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary text-sm"
            dir="ltr"
          />
          {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
        </div>

        {/* Info Box */}
        <div className="flex gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <Shield size={16} className="text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-text-muted space-y-1">
            <p>يُفحص الهدف بشكل آمن ومسؤول وفق أفضل معايير OWASP.</p>
            <p>لا تفحص إلا مواقع تملكها أو لديك تصريح بفحصها.</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={mut.isPending || !target.trim()}
          className="w-full bg-primary text-bg-dark font-semibold py-3 rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
        >
          {mut.isPending ? "جاري إنشاء الفحص..." : "ابدأ الفحص"}
        </button>
      </form>
    </div>
  );
}

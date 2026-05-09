import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi, subscriptionApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { PLAN_CONFIG } from "@/types";
import {
  User, Lock, CreditCard, Shield, CheckCircle2,
  Eye, EyeOff, Loader2, Smartphone, Copy, Check,
} from "lucide-react";

type Tab = "profile" | "security" | "plan";

// ── Reusable input ─────────────────────────────────────────────

function Field({
  label, value, onChange, type = "text", placeholder, disabled,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function Alert({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <div className={`text-sm rounded-xl px-4 py-3 ${
      type === "success"
        ? "bg-green-500/10 border border-green-500/30 text-green-400"
        : "bg-red-500/10 border border-red-500/30 text-red-400"
    }`}>
      {msg}
    </div>
  );
}

// ── Profile Tab ────────────────────────────────────────────────

function ProfileTab() {
  const { user, updateUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [company, setCompany] = useState(user?.company_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const initials = (user?.full_name ?? "U")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await authApi.updateProfile({ full_name: fullName, company_name: company, phone });
      updateUser(res.data);
      setMsg({ type: "success", text: "تم حفظ التغييرات بنجاح" });
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setMsg({ type: "error", text: detail?.message ?? "فشل الحفظ" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="text-xl font-bold text-primary">{initials}</span>
        </div>
        <div>
          <p className="font-semibold text-text-primary">{user?.full_name}</p>
          <p className="text-text-muted text-sm">{user?.email}</p>
          <p className="text-xs text-text-muted mt-0.5 capitalize">{user?.role} · {user?.plan}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="الاسم الكامل" value={fullName} onChange={setFullName} placeholder="الاسم الكامل" />
        <Field label="البريد الإلكتروني" value={user?.email ?? ""} disabled />
        <Field label="اسم الشركة" value={company} onChange={setCompany} placeholder="اسم الشركة (اختياري)" />
        <Field label="رقم الجوال" value={phone} onChange={setPhone} placeholder="+966 5XX XXX XXXX" />
      </div>

      {msg && <Alert type={msg.type} msg={msg.text} />}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-primary text-bg-dark text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        حفظ التغييرات
      </button>
    </div>
  );
}

// ── Security Tab ───────────────────────────────────────────────

function SecurityTab() {
  const { user, updateUser } = useAuthStore();

  // Change password
  const [current, setCurrent]     = useState("");
  const [newPwd, setNewPwd]       = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg]       = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 2FA
  const [twoFACode, setTwoFACode]     = useState("");
  const [twoFASecret, setTwoFASecret] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFASetup, setTwoFASetup]   = useState(false);
  const [twoFAMsg, setTwoFAMsg]       = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied]           = useState(false);

  const handleChangePassword = async () => {
    if (newPwd !== confirm) {
      setPwdMsg({ type: "error", text: "كلمة المرور الجديدة وتأكيدها غير متطابقين" });
      return;
    }
    setPwdLoading(true);
    setPwdMsg(null);
    try {
      await authApi.changePassword(current, newPwd);
      setPwdMsg({ type: "success", text: "تم تغيير كلمة المرور بنجاح" });
      setCurrent(""); setNewPwd(""); setConfirm("");
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setPwdMsg({ type: "error", text: detail?.message ?? "فشل تغيير كلمة المرور" });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    setTwoFALoading(true);
    setTwoFAMsg(null);
    try {
      const res = await authApi.setup2FA();
      setTwoFASecret(res.data.secret);
      setTwoFASetup(true);
    } catch {
      setTwoFAMsg({ type: "error", text: "فشل إعداد المصادقة الثنائية" });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!twoFACode) return;
    setTwoFALoading(true);
    try {
      await authApi.enable2FA(twoFACode);
      updateUser({ totp_enabled: true });
      setTwoFAMsg({ type: "success", text: "تم تفعيل المصادقة الثنائية بنجاح" });
      setTwoFASetup(false);
      setTwoFACode("");
      setTwoFASecret("");
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setTwoFAMsg({ type: "error", text: detail?.message ?? "الكود غير صحيح" });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!twoFACode) return;
    setTwoFALoading(true);
    try {
      await authApi.disable2FA(twoFACode);
      updateUser({ totp_enabled: false });
      setTwoFAMsg({ type: "success", text: "تم إيقاف المصادقة الثنائية" });
      setTwoFACode("");
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setTwoFAMsg({ type: "error", text: detail?.message ?? "الكود غير صحيح" });
    } finally {
      setTwoFALoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(twoFASecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="bg-bg-dark border border-border rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <Lock size={15} className="text-primary" /> تغيير كلمة المرور
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="relative">
            <label className="block text-xs font-medium text-text-muted mb-1.5">كلمة المرور الحالية</label>
            <input
              type={showPwd ? "text" : "password"}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              className="w-full bg-bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary pr-10"
            />
            <button
              onClick={() => setShowPwd(!showPwd)}
              className="absolute left-3 top-8 text-text-muted hover:text-text-primary"
            >
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <Field label="كلمة المرور الجديدة" value={newPwd} onChange={setNewPwd} type="password" />
          <Field label="تأكيد كلمة المرور" value={confirm} onChange={setConfirm} type="password" />
        </div>
        {pwdMsg && <Alert type={pwdMsg.type} msg={pwdMsg.text} />}
        <button
          onClick={handleChangePassword}
          disabled={pwdLoading || !current || !newPwd || !confirm}
          className="flex items-center gap-2 bg-primary text-bg-dark text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-40"
        >
          {pwdLoading ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
          تغيير كلمة المرور
        </button>
      </div>

      {/* 2FA */}
      <div className="bg-bg-dark border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-primary flex items-center gap-2">
            <Smartphone size={15} className="text-primary" /> المصادقة الثنائية (2FA)
          </h3>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            user?.totp_enabled
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-gray-500/10 text-gray-400 border border-gray-500/30"
          }`}>
            {user?.totp_enabled ? "مفعّل" : "معطّل"}
          </span>
        </div>

        {!user?.totp_enabled && !twoFASetup && (
          <div className="space-y-3">
            <p className="text-text-muted text-sm">
              المصادقة الثنائية تضيف طبقة حماية إضافية لحسابك. ستحتاج لتطبيق Google Authenticator أو Authy.
            </p>
            <button
              onClick={handleSetup2FA}
              disabled={twoFALoading}
              className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 text-sm px-4 py-2 rounded-xl hover:bg-primary/20"
            >
              {twoFALoading ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
              تفعيل المصادقة الثنائية
            </button>
          </div>
        )}

        {!user?.totp_enabled && twoFASetup && twoFASecret && (
          <div className="space-y-4">
            <div className="bg-bg-card border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-text-muted">المفتاح السري — أدخله يدوياً في تطبيق المصادقة</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-primary bg-bg-dark px-3 py-2 rounded-lg break-all">
                  {twoFASecret}
                </code>
                <button
                  onClick={copySecret}
                  className="p-2 rounded-lg hover:bg-bg-dark text-text-muted hover:text-text-primary"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-text-muted">
                افتح تطبيق المصادقة ← أضف حساباً ← ادخل المفتاح يدوياً ← اختر نوع TOTP
              </p>
            </div>
            <Field
              label="أدخل الكود من تطبيق المصادقة للتحقق"
              value={twoFACode}
              onChange={setTwoFACode}
              placeholder="123456"
            />
            <div className="flex gap-2">
              <button
                onClick={handleEnable2FA}
                disabled={twoFALoading || twoFACode.length < 6}
                className="flex items-center gap-2 bg-primary text-bg-dark text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-40"
              >
                {twoFALoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                تفعيل
              </button>
              <button
                onClick={() => { setTwoFASetup(false); setTwoFASecret(""); setTwoFACode(""); }}
                className="text-sm text-text-muted px-4 py-2 rounded-xl hover:text-text-primary"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {user?.totp_enabled && (
          <div className="space-y-3">
            <p className="text-text-muted text-sm">
              لإيقاف المصادقة الثنائية، أدخل الكود من تطبيق المصادقة.
            </p>
            <Field
              label="كود المصادقة الثنائية"
              value={twoFACode}
              onChange={setTwoFACode}
              placeholder="123456"
            />
            <button
              onClick={handleDisable2FA}
              disabled={twoFALoading || twoFACode.length < 6}
              className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 text-sm px-4 py-2 rounded-xl hover:bg-red-500/20 disabled:opacity-40"
            >
              {twoFALoading ? <Loader2 size={13} className="animate-spin" /> : null}
              إيقاف المصادقة الثنائية
            </button>
          </div>
        )}

        {twoFAMsg && <Alert type={twoFAMsg.type} msg={twoFAMsg.text} />}
      </div>
    </div>
  );
}

// ── Plan Tab ───────────────────────────────────────────────────

function PlanTab() {
  const { user } = useAuthStore();
  const plan = (user?.plan ?? "free") as keyof typeof PLAN_CONFIG;
  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.free;

  const { data: usage } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => (await subscriptionApi.getUsage()).data,
  });

  function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
    const pct = max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
    const color = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-primary";
    return (
      <div>
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>{label}</span>
          <span>{used.toLocaleString()} / {max < 0 ? "∞" : max.toLocaleString()}</span>
        </div>
        <div className="w-full bg-bg-dark rounded-full h-1.5">
          <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <div className={`rounded-2xl p-5 border ${cfg.bgColor} ${cfg.borderColor}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-text-muted mb-0.5">خطتك الحالية</p>
            <p className={`text-2xl font-bold ${cfg.color}`}>{cfg.nameAr}</p>
          </div>
          <div className={`text-3xl font-black ${cfg.color} opacity-20`}>{cfg.name[0]}</div>
        </div>
        {user?.plan_expires_at && (
          <p className="text-xs text-text-muted">
            تنتهي في: {new Date(user.plan_expires_at).toLocaleDateString("ar-SA")}
          </p>
        )}
        {plan === "free" && (
          <p className="text-xs text-text-muted">الخطة المجانية — لا تاريخ انتهاء</p>
        )}
      </div>

      {/* Usage */}
      {usage && (
        <div className="bg-bg-dark border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-text-primary text-sm">الاستهلاك هذا الشهر</h3>
          <UsageBar label="الفحوصات" used={usage.scans_this_month ?? 0} max={cfg.scansPerMonth} />
          <UsageBar label="رسائل AI" used={usage.ai_chat_messages ?? 0} max={cfg.aiChatPerMonth} />
        </div>
      )}

      {/* Upgrade prompt */}
      {plan !== "enterprise" && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-text-primary text-sm">ارقِ خطتك</p>
            <p className="text-text-muted text-xs mt-0.5">احصل على فحوصات ورسائل AI أكثر</p>
          </div>
          <a
            href="/billing"
            className="shrink-0 bg-primary text-bg-dark text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90"
          >
            ترقية الخطة
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main Settings Page ─────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState<Tab>("profile");

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "profile",  label: "الملف الشخصي", icon: User },
    { id: "security", label: "الأمان",        icon: Lock },
    { id: "plan",     label: "الخطة",         icon: CreditCard },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">الإعدادات</h1>
        <p className="text-text-muted text-sm mt-1">إدارة حسابك وإعدادات الأمان</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-card border border-border rounded-2xl p-1.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
              tab === id
                ? "bg-primary text-bg-dark"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        {tab === "profile"  && <ProfileTab />}
        {tab === "security" && <SecurityTab />}
        {tab === "plan"     && <PlanTab />}
      </div>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Shield, Zap, Globe, FileSearch, Brain, BarChart3,
  ChevronRight, CheckCircle2, ArrowRight, Star,
  Lock, Eye, Code2, AlertTriangle
} from "lucide-react";

const PLANS = [
  { key: "free", price: "0", color: "border-gray-600" },
  { key: "starter", price: "99", color: "border-primary-500" },
  { key: "professional", price: "299", color: "border-accent ring-2 ring-accent/30", popular: true },
  { key: "business", price: "999", color: "border-primary-400" },
  { key: "enterprise", price: "4,999+", color: "border-purple-500" },
];

const FEATURES = [
  { icon: FileSearch, key: "scan", color: "text-blue-400" },
  { icon: Brain, key: "ai", color: "text-purple-400" },
  { icon: Shield, key: "compliance", color: "text-green-400" },
  { icon: Code2, key: "remediation", color: "text-orange-400" },
  { icon: Globe, key: "arabic", color: "text-cyan-400" },
  { icon: BarChart3, key: "billing", color: "text-yellow-400" },
];

const STATS = [
  { value: "10+", label: "أنواع الفحص" },
  { value: "8", label: "ميزات AI" },
  { value: "99%", label: "دقة الكشف" },
  { value: "24/7", label: "مراقبة مستمرة" },
];

export default function Landing() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  return (
    <div className="min-h-screen bg-bg-dark text-white">
      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-32">
        {/* خلفية متوهجة */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/30 rounded-full px-4 py-1.5 text-sm text-primary-300 mb-6"
          >
            <Zap size={14} className="text-accent" />
            {t("hero.badge")}
          </motion.div>

          {/* العنوان الرئيسي */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold leading-tight mb-6"
          >
            {isAr ? (
              <>
                <span className="text-white">{t("hero.title")}</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent">
                  🦅 أمان الصقر
                </span>
              </>
            ) : (
              <>
                <span className="text-white">{t("hero.title")} </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent">
                  {t("hero.titleHighlight")} 🦅
                </span>
              </>
            )}
          </motion.h1>

          {/* الوصف */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed"
          >
            {t("hero.subtitle")}
          </motion.p>

          {/* الأزرار */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <button className="group flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5">
              {t("hero.cta")}
              <ArrowRight size={18} className="group-hover:translate-x-1 rtl:rotate-180 transition-transform" />
            </button>
            <button className="flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5">
              {t("hero.ctaSecondary")}
            </button>
          </motion.div>

          {/* إحصائيات سريعة */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
          >
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="bg-surface-dark/50 border border-slate-800 rounded-2xl p-4 text-center"
              >
                <div className="text-3xl font-bold text-primary-400 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features Section ──────────────────────────────────── */}
      <section className="px-6 py-24 bg-surface-dark/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t("features.title")}</h2>
            <p className="text-slate-400 text-lg">{t("features.subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, key, color }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-surface-dark border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 group"
              >
                <div className={`w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon size={24} className={color} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {t(`features.${key}.desc`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Section ───────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t("pricing.title")}</h2>
            <p className="text-slate-400 text-lg">{t("pricing.subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {PLANS.map(({ key, price, color, popular }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`relative bg-surface-dark border-2 ${color} rounded-2xl p-6 flex flex-col`}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star size={10} />
                    {t("pricing.mostPopular")}
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-white mb-1">
                    {t(`pricing.${key}.name`)}
                  </h3>
                  <p className="text-slate-400 text-xs">
                    {t(`pricing.${key}.desc`)}
                  </p>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">{price}</span>
                  {price !== "0" && (
                    <span className="text-slate-400 text-sm">
                      {" "}
                      {t("common.sar")}/{t("common.month")}
                    </span>
                  )}
                </div>
                <button
                  className={`mt-auto w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    popular
                      ? "bg-accent hover:bg-accent-dark text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  {key === "enterprise"
                    ? t("pricing.ctaEnterprise")
                    : t("pricing.cta")}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 px-6 py-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-sm">
          <div className="flex items-center gap-2">
            <Eye size={20} className="text-primary-400" />
            <span className="font-bold text-white">Saqr Security</span>
            <span>— {t("common.tagline")}</span>
          </div>
          <div>
            © {new Date().getFullYear()} Saqr Security. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

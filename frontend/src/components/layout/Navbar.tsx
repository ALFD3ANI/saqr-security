import { useTranslation } from "react-i18next";
import { Eye, Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

export function Navbar() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { label: t("nav.features"), href: "#features" },
    { label: t("nav.pricing"), href: "#pricing" },
    { label: t("nav.about"), href: "#about" },
  ];

  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-slate-800/80 bg-bg-dark/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* الشعار */}
        <a href="/" className="flex items-center gap-2 font-bold text-xl">
          <Eye size={24} className="text-primary-400" />
          <span className="text-white">Saqr</span>
          <span className="text-primary-400">Security</span>
        </a>

        {/* روابط (desktop) */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-slate-400 hover:text-white transition-colors text-sm font-medium"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* الجانب الأيمن */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
          <button className="hidden md:block bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            {t("common.login")}
          </button>
          <button
            className="md:hidden p-2 text-slate-400"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* قائمة الموبايل */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-800 bg-bg-dark px-6 py-4 flex flex-col gap-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-slate-300 hover:text-white text-sm py-2"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <button className="bg-primary-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
            {t("common.login")}
          </button>
        </div>
      )}
    </nav>
  );
}

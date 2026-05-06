import { useTranslation } from "react-i18next";
import { toggleLanguage } from "@/i18n";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all duration-200 text-sm font-medium"
      title="Switch language"
    >
      <Languages size={16} />
      <span>{isAr ? "EN" : "عر"}</span>
    </button>
  );
}

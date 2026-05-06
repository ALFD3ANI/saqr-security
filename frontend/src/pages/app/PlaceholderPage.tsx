import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  title: string;
  phase: number;
  description?: string;
}

export default function PlaceholderPage({ title, phase, description }: Props) {
  const { i18n } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <Construction size={28} className="text-slate-500" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
      <p className="text-slate-500 text-sm max-w-sm">
        {description ?? (i18n.language === "ar"
          ? `هذه الصفحة ستُبنى في المرحلة ${phase} 🚧`
          : `This page will be built in Phase ${phase} 🚧`)}
      </p>
    </div>
  );
}

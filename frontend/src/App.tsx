import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { initTheme } from "@/stores/themeStore";
import { Navbar } from "@/components/layout/Navbar";
import Landing from "@/pages/Landing";

initTheme();

export default function App() {
  const { i18n } = useTranslation();

  // مزامنة الـ direction مع اللغة
  useEffect(() => {
    const dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-dark">
        <Navbar />
        <main className="pt-16">
          <Routes>
            <Route path="/" element={<Landing />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

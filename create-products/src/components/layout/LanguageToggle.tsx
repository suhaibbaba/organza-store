"use client";
import { useLocale, useTranslations } from "next-intl";

export function LanguageToggle() {
  const locale = useLocale();
  const t = useTranslations();

  const switchLocale = () => {
    const next = locale === "ar" ? "en" : "ar";
    const path = window.location.pathname.replace(`/${locale}`, `/${next}`);
    window.location.href = path + window.location.search;
  };

  return (
    <button
      onClick={switchLocale}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium w-full"
    >
      <span className="text-base">🌐</span>
      <span>{t("language")}</span>
    </button>
  );
}

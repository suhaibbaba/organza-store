"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/constants/locale";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Languages className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t("language")}</span>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          aria-current={loc === locale}
          className={cn(
            "min-h-11 rounded-md px-3 text-sm font-medium transition-colors",
            loc === locale ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent"
          )}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/constants/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  // "dropdown": a single trigger + menu (desktop header). "list": all
  // locales laid out as buttons (mobile "More" sheet, where a nested
  // popup would be awkward inside an already-open sheet).
  variant?: "dropdown" | "list";
}

export function LanguageSwitcher({ className, variant = "list" }: LanguageSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");

  function handleChange(loc: AppLocale) {
    router.replace(pathname, { locale: loc });
  }

  if (variant === "dropdown") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium text-foreground",
            "transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "data-[state=open]:bg-accent",
            className
          )}
        >
          <Languages className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{t("language")}</span>
          <span>{LOCALE_LABELS[locale]}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={locale} onValueChange={(value) => handleChange(value as AppLocale)}>
            {routing.locales.map((loc) => (
              <DropdownMenuRadioItem key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Languages className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t("language")}</span>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => handleChange(loc)}
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

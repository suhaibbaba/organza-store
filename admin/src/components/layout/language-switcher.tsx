"use client";

import { useLocale, useTranslations } from "next-intl";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/constants/locale";
import { cn } from "@/lib/utils";
import { testSelectorFor } from "@organza/shared/lib/testSelector";

interface LanguageSwitcherProps {
  className?: string;
  // "menu": a heading + radio items inside an open account menu; "list": a row of buttons (signed-out pages, More sheet).
  variant?: "menu" | "list";
}

export function LanguageSwitcher({ className, variant = "list" }: LanguageSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");

  // Navigating writes next-intl's locale cookie, which is what makes the choice survive a relaunch.
  function handleChange(loc: AppLocale) {
    router.replace(pathname, { locale: loc });
  }

  if (variant === "menu") {
    return (
      <>
        <DropdownMenuPrimitive.Label
          id={LANGUAGE_GROUP_LABEL_ID}
          className="flex items-center gap-2 px-3 pb-1 pt-2 text-meta font-medium text-ink-subtle"
        >
          <Languages className="size-4 shrink-0" aria-hidden="true" />
          {t("language")}
        </DropdownMenuPrimitive.Label>
        <DropdownMenuPrimitive.RadioGroup
          aria-labelledby={LANGUAGE_GROUP_LABEL_ID}
          value={locale}
          onValueChange={(value) => handleChange(value as AppLocale)}
          className={className}
        >
          {routing.locales.map((loc) => (
            <DropdownMenuPrimitive.RadioItem
              key={loc}
              value={loc}
              data-test-selector={testSelectorFor("language-option", loc)}
              className={cn(
                "flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-control px-3 py-2 lg:min-h-9",
                "text-value text-ink-muted outline-none transition-colors duration-150 data-highlighted:bg-inset",
                "data-[state=checked]:font-semibold data-[state=checked]:text-ink"
              )}
            >
              <span className="flex-1 truncate text-start">{LOCALE_LABELS[loc]}</span>
              <DropdownMenuPrimitive.ItemIndicator>
                <Check className="size-4 text-primary-600" aria-hidden="true" />
              </DropdownMenuPrimitive.ItemIndicator>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuPrimitive.RadioGroup>
      </>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)} data-test-selector="language-switcher">
      <Languages className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <span className="sr-only">{t("language")}</span>
      {routing.locales.map((loc) => (
        <button
          data-test-selector={testSelectorFor("language-option", loc)}
          key={loc}
          type="button"
          onClick={() => handleChange(loc)}
          aria-current={loc === locale}
          className={cn(
            "pill-text min-h-11 cursor-pointer rounded-pill px-3 text-label font-medium transition-colors duration-150",
            loc === locale ? "bg-primary-100 text-primary-700" : "text-ink-muted hover:bg-inset hover:text-ink"
          )}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}

const LANGUAGE_GROUP_LABEL_ID = "language-group-label";

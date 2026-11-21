"use client";

import { useLocale, useTranslations } from "next-intl";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/constants/locale";
import { cn } from "@/lib/utils";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { useRememberLocale } from "@/hooks/use-profile";

interface LanguageSwitcherProps {
  className?: string;
  // "pill": a header button opening the languages; "menu": radio items inside an open menu; "list": a row of buttons.
  variant?: "pill" | "menu" | "list";
}

export function LanguageSwitcher({ className, variant = "list" }: LanguageSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");
  const remember = useRememberLocale();

  // Navigating writes next-intl's locale cookie, which is what makes the choice survive a relaunch.
  function handleChange(loc: AppLocale) {
    remember(loc);
    router.replace(pathname, { locale: loc });
  }

  if (variant === "pill") {
    return (
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger
          aria-label={t("language")}
          data-test-selector="language-switcher"
          className={cn(
            "flex h-(--control-h) shrink-0 cursor-pointer items-center gap-1.5 rounded-control border border-line bg-surface px-2.5",
            "text-label font-medium text-ink transition-colors duration-150 hover:bg-primary-50 data-[state=open]:bg-primary-50",
            className
          )}
        >
          <Languages className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-40 rounded-panel border border-line bg-surface p-1 shadow-card"
          >
            <LanguageSwitcher variant="menu" />
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    );
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
            loc === locale
              ? "bg-primary-100 text-primary-700 focus-visible:bg-primary-300 focus-visible:text-primary-900"
              : "text-ink-muted hover:bg-inset hover:text-ink focus-visible:bg-neutral-200 focus-visible:text-ink"
          )}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}

const LANGUAGE_GROUP_LABEL_ID = "language-group-label";

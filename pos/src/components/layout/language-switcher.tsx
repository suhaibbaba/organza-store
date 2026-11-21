"use client";

import { useLocale, useTranslations } from "next-intl";
import { Icon, Menu, MenuContent, MenuItem, MenuTrigger } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/constants/locale";
import { TOP_BAR_PILL } from "@/components/layout/top-bar-pill";
import { cn } from "@/lib/utils";
import { useRememberLocale } from "@/hooks/use-profile";

interface LanguageSwitcherProps {
  className?: string;
  // "pill": the top bar's menu; "list": a row of buttons for the signed-out pages.
  variant?: "list" | "pill";
}

// Every language is written in its own script, so it is legible even when the interface around it is not.
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
      <Menu>
        <MenuTrigger
          aria-label={t("language")}
          data-test-selector="pos-language-menu"
          className={cn(TOP_BAR_PILL, className)}
        >
          <Icon name="globe" className="size-5 shrink-0 text-ink-muted" />
          <span className="truncate text-label font-semibold">{LOCALE_LABELS[locale]}</span>
          <Icon name="chevron-down" className="size-4 shrink-0 text-ink-muted" />
        </MenuTrigger>
        <MenuContent align="end" className="min-w-44">
          {routing.locales.map((loc) => (
            <MenuItem
              key={loc}
              icon="language"
              data-testid={testSelectorFor("pos-language-option", loc)}
              onSelect={() => handleChange(loc)}
              trailing={loc === locale ? <Icon name="check" className="size-4 text-primary-600" /> : undefined}
            >
              <span className={cn(loc === locale && "font-semibold")}>{LOCALE_LABELS[loc]}</span>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)} data-test-selector="pos-language-switcher">
      <Icon name="language" className="size-4 shrink-0 text-ink-muted" />
      <span className="sr-only">{t("language")}</span>
      {routing.locales.map((loc) => (
        <button
          data-test-selector={testSelectorFor("pos-language-option", loc)}
          key={loc}
          type="button"
          onClick={() => handleChange(loc)}
          aria-current={loc === locale}
          className={cn(
            "min-h-11 cursor-pointer rounded-control px-3 text-label font-medium transition-colors",
            loc === locale
              ? "bg-primary-100 text-primary-700 focus-visible:bg-primary-300 focus-visible:text-primary-900"
              : "text-ink-muted hover:bg-inset focus-visible:bg-neutral-200 focus-visible:text-ink"
          )}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}

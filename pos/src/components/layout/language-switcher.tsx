"use client";

import { useLocale, useTranslations } from "next-intl";
import { Icon, Menu, MenuContent, MenuItem, MenuTrigger, SegmentedControl } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/constants/locale";
import { TOP_BAR_PILL } from "@/components/layout/top-bar-pill";
import { cn } from "@/lib/utils";
import { useRememberLocale } from "@/hooks/use-profile";

interface LanguageSwitcherProps {
  className?: string;
  // "pill": the top bar's menu; "list": segments for the signed-out pages.
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
    <SegmentedControl<AppLocale>
      label={t("language")}
      value={locale}
      onChange={handleChange}
      options={routing.locales.map((loc) => ({ value: loc, label: LOCALE_LABELS[loc] }))}
      data-testid="pos-language-option"
      className={className}
    />
  );
}

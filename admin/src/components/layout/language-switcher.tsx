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
import { testSelectorFor } from "@organza/shared/lib/testSelector";

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

  // Moves to the same screen in the chosen language *and* records the choice:
  // next-intl writes the locale cookie configured in i18n/routing.ts as it
  // navigates. That cookie is the whole point — it is what proxy.ts reads on
  // the next launch, so the pick survives a reload, a service-worker update,
  // and the app being closed, instead of living only in the current URL.
  function handleChange(loc: AppLocale) {
    router.replace(pathname, { locale: loc });
  }

  if (variant === "dropdown") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          data-test-selector="language-switcher"
          className={cn(
            "flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-md border border-input px-2 text-sm font-medium text-foreground sm:px-3",
            "transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "data-[state=open]:bg-accent",
            className
          )}
        >
          <Languages className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{t("language")}</span>
          {/* The current language's own name, dropped on a narrow phone.
              Nothing is lost by that: the whole interface is already written
              in it, so the icon alone says "change language" — and the menu
              this opens ticks the one in use. What it buys is the ~60px that
              keeps the sandbox chip and the account button from having to
              fight for the same row. The sr-only label above is unconditional,
              so a screen reader is unaffected either way. */}
          <span className="hidden truncate sm:inline">{LOCALE_LABELS[locale]}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={locale} onValueChange={(value) => handleChange(value as AppLocale)}>
            {routing.locales.map((loc) => (
              <DropdownMenuRadioItem
                key={loc}
                value={loc}
                data-test-selector={testSelectorFor("language-option", loc)}
              >
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
          data-test-selector={testSelectorFor("language-option", loc)}
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

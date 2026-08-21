"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/constants/locale";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { testSelectorFor } from "@organza/shared/lib/testSelector";

interface LanguageSwitcherProps {
  className?: string;
  // "menu": the language section OF AN OPEN DROPDOWN — a heading and the
  // locales as radio items, composed inside somebody else's
  // DropdownMenuContent (the account menu). Deliberately not its own popup:
  // a submenu would put the shop's own language two levels down, and the
  // whole point of moving this here was to make it fewer things on screen,
  // not more taps.
  //
  // "list": every locale as a button in a row — the signed-out pages and the
  // "More" sheet, where there is no menu to sit inside and a nested popup in
  // an already-open sheet would be awkward.
  variant?: "menu" | "list";
}

// HOW THE LANGUAGE IS CHOSEN — one component, wherever the choosing happens.
//
// It used to have a `dropdown` variant of its own, and that control sat in
// the top bar beside the account menu. Four things then shared that row —
// the shop's name, the sandbox chip, the language and the account — and on a
// phone the language had already given up its label and collapsed to a bare
// icon to make room. An unlabelled icon is the wrong thing to leave for staff
// who are not tech-savvy (CLAUDE.md "Frontend UX"), and it was the fourth
// thing in a row that only had space for three.
//
// So it moved INTO the account menu, next to sign-out, which is where a
// person's own preferences belong and where the "More" sheet had been putting
// it all along. The header is down to the shop, the chip and the account, and
// the language is still two taps away with its name written out in full.
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

  if (variant === "menu") {
    return (
      // A fragment, not a wrapper: these are the menu's own children, and
      // Radix walks the content's descendants to work out arrow-key order and
      // typeahead. A div between them is a div the keyboard has to guess at.
      <>
        <DropdownMenuLabel id={LANGUAGE_GROUP_LABEL_ID} className="flex items-center gap-2">
          <Languages className="size-4 shrink-0" aria-hidden="true" />
          {t("language")}
        </DropdownMenuLabel>
        {/* Which one is on is answered here, in the menu itself, rather than
            behind another tap: the group ticks the current locale and prints
            it darker than the rest. Every language is written in its OWN
            script — العربية, English, עברית — so it is legible to whoever
            wants it even when the interface around it is not in a language
            they read, which is the whole reason somebody opens this. */}
        <DropdownMenuRadioGroup
          aria-labelledby={LANGUAGE_GROUP_LABEL_ID}
          value={locale}
          onValueChange={(value) => handleChange(value as AppLocale)}
          className={className}
        >
          {routing.locales.map((loc) => (
            <DropdownMenuRadioItem
              key={loc}
              value={loc}
              data-test-selector={testSelectorFor("language-option", loc)}
              className="data-[state=checked]:font-semibold data-[state=checked]:text-foreground"
            >
              {LOCALE_LABELS[loc]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)} data-test-selector="language-switcher">
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

// The heading the radio group points at, so a screen reader announces "Language,
// three options" rather than three unexplained items in the middle of an
// account menu. A constant because the two have to agree and there is exactly
// one of this group on screen at a time.
const LANGUAGE_GROUP_LABEL_ID = "language-group-label";

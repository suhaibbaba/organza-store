"use client";

import { type FormEvent, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { ScanLine, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onScanClick: () => void;
  // Called when the field is submitted, i.e. what's in it is a code rather
  // than a name to search for.
  onSubmitCode: (code: string) => void;
  isLooking: boolean;
  // Lets the screen put the cursor here from the counter keyboard. Only ever
  // used by a deliberate keypress — never on mount, which on a phone would
  // throw the keyboard open over the cart before anyone asked for it.
  inputRef?: RefObject<HTMLInputElement | null>;
}

// The one thing on screen the cashier touches first. It does double duty:
//
//   - typing searches the catalogue as you go (the fallback for when the
//     camera can't read a tag), and
//   - submitting it looks the text up as a barcode/SKU and adds that item
//     straight to the cart.
//
// The second behaviour is what makes a plug-in barcode wedge work while the
// box has the cursor: those scanners type the code into whatever field has
// focus and press Enter, so the same box serves the phone camera, a hardware
// scanner, and a cashier reading a damaged label out by hand. At the counter
// the usual case is nothing focused at all, which the screen listens for
// separately (hooks/use-hardware-scanner.ts) — this box is never focused on
// its own initiative.
export function SearchBar({ value, onChange, onScanClick, onSubmitCode, isLooking, inputRef }: SearchBarProps) {
  const t = useTranslations("sell.search");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const code = value.trim();
    if (!code) return;
    onSubmitCode(code);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2" role="search">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          autoComplete="off"
          // A wedge scanner's "Enter" is a form submit; on a phone keyboard
          // the same key reads as "search", which is also what it does.
          enterKeyHint="search"
          className="ps-11 pe-11"
        />
        {isLooking ? (
          <span className="absolute end-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Spinner />
            <span className="sr-only">{t("looking")}</span>
          </span>
        ) : (
          value && (
            <button
              type="button"
              // Clears and stops there. Putting the cursor back in the box
              // would throw the phone keyboard open over half the screen
              // when all the cashier asked for was the cart back — the
              // keyboard belongs to whoever actually taps the field.
              onClick={() => onChange("")}
              aria-label={t("clear")}
              className="absolute end-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )
        )}
      </div>

      <Button type="button" size="icon" onClick={onScanClick} aria-label={t("scan")} className="shrink-0">
        <ScanLine aria-hidden="true" />
      </Button>
    </form>
  );
}

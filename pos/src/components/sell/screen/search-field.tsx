"use client";

import type { FormEvent, RefObject } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { TAB_MEDIA_QUERY } from "@/constants/layout";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Spinner } from "@store/ui";
import { cn } from "@/lib/utils";
import { CONTROL_HEIGHT } from "@/components/sell/screen/control-styles";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  // Enter looks the text up as a code typed off a label, the same lookup a scan runs.
  onSubmitCode: (code: string) => void;
  isLooking: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

// Typing narrows the grid (cross-language backend search, rule 10); Enter looks the text up as a barcode or SKU.
export function SearchField({ value, onChange, onSubmitCode, isLooking, inputRef, className }: SearchFieldProps) {
  const t = useTranslations("sell");
  const isTab = useMediaQuery(TAB_MEDIA_QUERY);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const code = value.trim();
    if (code) onSubmitCode(code);
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={cn("relative min-w-0", className)} data-test-selector="pos-search">
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // The full sentence does not fit beside two buttons at 390px.
        placeholder={isTab ? t("screen.searchPlaceholder") : t("screen.searchPlaceholderShort")}
        aria-label={t("search.label")}
        autoComplete="off"
        enterKeyHint="search"
        data-test-selector="pos-search-input"
        className={cn(
          CONTROL_HEIGHT,
          "w-full rounded-control border border-line-strong bg-surface ps-9 pe-10 text-field text-ink hover:border-neutral-400",
          "placeholder:text-ink-subtle transition-[border-color,box-shadow] focus-visible:border-primary-600 focus-visible:shadow-field-focus focus-visible:outline-none"
        )}
      />
      {isLooking ? (
        <span className="absolute end-3 top-1/2 -translate-y-1/2">
          <Spinner label={t("search.looking")} />
        </span>
      ) : (
        value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("search.clear")}
            data-test-selector="pos-search-clear"
            className="hit-area absolute end-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center cursor-pointer rounded-control text-ink-faint hover:bg-inset hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )
      )}
    </form>
  );
}

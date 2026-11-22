"use client";

import type { FormEvent, RefObject } from "react";
import { useTranslations } from "next-intl";
import { SearchField as UiSearchField, Spinner } from "@store/ui";
import { useMediaQuery } from "@/hooks/use-media-query";
import { TAB_MEDIA_QUERY } from "@/constants/layout";
import { cn } from "@/lib/utils";

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
    if (code) {
      onSubmitCode(code);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn("relative min-w-0", className)}
      data-test-selector="pos-search"
    >
      <UiSearchField
        ref={inputRef}
        label={t("search.label")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClear={isLooking ? undefined : () => onChange("")}
        clearLabel={t("search.clear")}
        // The full sentence does not fit beside two buttons at 390px.
        placeholder={isTab ? t("screen.searchPlaceholder") : t("screen.searchPlaceholderShort")}
        autoComplete="off"
        enterKeyHint="search"
        data-testid="pos-search-input"
      />
      {isLooking && (
        <span className="absolute end-3 top-1/2 -translate-y-1/2">
          <Spinner label={t("search.looking")} />
        </span>
      )}
    </form>
  );
}

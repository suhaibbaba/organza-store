"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

interface OrderSearchProps {
  value: string;
  onChange: (value: string) => void;
}

// Staff look an order up by whatever they have in front of them: the number
// on the receipt, or the customer's name/phone from the chat — the backend
// matches all three from this one box.
export function OrderSearch({ value, onChange }: OrderSearchProps) {
  const t = useTranslations("orders.search");

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("label")}
        className="ps-11 pe-11"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("clear")}
          className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

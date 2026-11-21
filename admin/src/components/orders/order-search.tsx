"use client";

import { useTranslations } from "next-intl";
import { Input } from "@store/ui";

interface OrderSearchProps {
  value: string;
  onChange: (value: string) => void;
}

// One box matches the receipt number, the customer's name or phone (backend searches all three).
export function OrderSearch({ value, onChange }: OrderSearchProps) {
  const t = useTranslations("orders.search");

  return (
    <Input
      type="search"
      adornment="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClear={() => onChange("")}
      clearLabel={t("clear")}
      placeholder={t("placeholder")}
      aria-label={t("label")}
      data-testid="orders-search"
    />
  );
}

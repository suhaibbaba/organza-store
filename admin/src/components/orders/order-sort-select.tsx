"use client";

import { useTranslations } from "next-intl";
import { ORDER_SORT_OPTIONS } from "@/constants/orders";
import { Select } from "@/components/ui/select";
import type { OrderListFilters } from "@/types/order";

interface OrderSortSelectProps {
  sortBy: OrderListFilters["sortBy"];
  sortDir: OrderListFilters["sortDir"];
  onChange: (sortBy: OrderListFilters["sortBy"], sortDir: OrderListFilters["sortDir"]) => void;
}

export function OrderSortSelect({ sortBy, sortDir, onChange }: OrderSortSelectProps) {
  const t = useTranslations("orders.sort");
  const value = `${sortBy}-${sortDir}`;

  return (
    <Select
      aria-label={t("label")}
      value={value}
      onChange={(e) => {
        const option = ORDER_SORT_OPTIONS.find((o) => o.value === e.target.value);
        if (option) onChange(option.sortBy, option.sortDir);
      }}
    >
      {ORDER_SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {t(option.labelKey)}
        </option>
      ))}
    </Select>
  );
}

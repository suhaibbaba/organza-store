"use client";

import { useTranslations } from "next-intl";
import { Select } from "@store/ui";
import { ORDER_SORT_OPTIONS } from "@/constants/orders";
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
      data-testid="orders-sort"
      aria-label={t("label")}
      value={value}
      options={ORDER_SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
      onChange={(e) => {
        const option = ORDER_SORT_OPTIONS.find((o) => o.value === e.target.value);
        if (option) onChange(option.sortBy, option.sortDir);
      }}
    />
  );
}

"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button, Chip, ChipGroup, DateRangePicker, Drawer, FormField, Select, Switch } from "@store/ui";
import { ORDER_CHANNELS, ORDER_STATUSES, PAYMENT_STATUSES } from "@organza/shared/constants/order";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { DEFAULT_ORDER_FILTERS, ORDER_SORT_OPTIONS } from "@/constants/orders";
import { formatDate } from "@/lib/format";
import type { OrderListFilters } from "@/types/order";

export interface OrderFiltersValue {
  status: OrderListFilters["status"];
  channel: OrderListFilters["channel"];
  paymentStatus: OrderListFilters["paymentStatus"];
  hasQuickSale: boolean;
  dateFrom: string;
  dateTo: string;
}

export interface OrderSortValue {
  sortBy: OrderListFilters["sortBy"];
  sortDir: OrderListFilters["sortDir"];
}

export const EMPTY_ORDER_FILTERS: OrderFiltersValue = {
  status: null,
  channel: null,
  paymentStatus: null,
  hasQuickSale: false,
  dateFrom: DEFAULT_ORDER_FILTERS.dateFrom,
  dateTo: DEFAULT_ORDER_FILTERS.dateTo,
};

export function countOrderFilters(value: OrderFiltersValue): number {
  return [value.status, value.channel, value.paymentStatus, value.hasQuickSale, value.dateFrom || value.dateTo].filter(
    Boolean
  ).length;
}

interface OrderFiltersProps {
  value: OrderFiltersValue;
  sort: OrderSortValue;
  onApply: (value: OrderFiltersValue, sort: OrderSortValue) => void;
}

export function OrderFilters({ value, sort, onApply }: OrderFiltersProps) {
  const t = useTranslations("orders.filters");
  const tSort = useTranslations("orders.sort");
  const tStatus = useTranslations("orders.status");
  const tChannel = useTranslations("orders.channel");
  const tPayment = useTranslations("orders.paymentStatus");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [draftSort, setDraftSort] = useState(sort);
  const activeCount = countOrderFilters(value);

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(value);
      setDraftSort(sort);
    }
    setOpen(next);
  }

  function apply(next: OrderFiltersValue) {
    onApply(next, draftSort);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => handleOpenChange(true)}
        data-test-selector="order-filters-open"
        className="relative shrink-0"
        icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
      >
        {t("trigger")}
        {activeCount > 0 && (
          <span className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-pill bg-primary-600 text-micro text-ink-inverse">
            {activeCount}
          </span>
        )}
      </Button>

      <Drawer
        data-testid="sheet-order-filters"
        open={open}
        onOpenChange={handleOpenChange}
        title={t("title")}
        descriptionKey="orders.filters.title"
        footer={
          <>
            <Button variant="secondary" onClick={() => apply(EMPTY_ORDER_FILTERS)} data-test-selector="order-filters-reset">
              {t("reset")}
            </Button>
            <Button onClick={() => apply(draft)} data-test-selector="order-filters-apply">
              {t("apply")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField label="orders.sort.label" hint="orders.filters.sortHint" htmlFor="order-filter-sort">
            <Select
              id="order-filter-sort"
              data-testid="orders-sort"
              value={`${draftSort.sortBy}-${draftSort.sortDir}`}
              options={ORDER_SORT_OPTIONS.map((option) => ({ value: option.value, label: tSort(option.labelKey) }))}
              onChange={(e) => {
                const option = ORDER_SORT_OPTIONS.find((o) => o.value === e.target.value);
                if (option) setDraftSort({ sortBy: option.sortBy, sortDir: option.sortDir });
              }}
            />
          </FormField>

          <FormField label="orders.filters.status" hint="orders.filters.statusHint" htmlFor="order-filter-status">
            <Select
              id="order-filter-status"
              data-testid={fieldTestSelector("order-filter-status")}
              placeholder={t("statusAll")}
              value={draft.status ?? ""}
              options={ORDER_STATUSES.map((status) => ({ value: status, label: tStatus(status) }))}
              onChange={(e) =>
                setDraft((d) => ({ ...d, status: (e.target.value || null) as OrderFiltersValue["status"] }))
              }
            />
          </FormField>

          <FormField label="orders.filters.channel" hint="orders.filters.channelHint" htmlFor="order-filter-channel">
            <Select
              id="order-filter-channel"
              data-testid={fieldTestSelector("order-filter-channel")}
              placeholder={t("channelAll")}
              value={draft.channel ?? ""}
              options={ORDER_CHANNELS.map((channel) => ({ value: channel, label: tChannel(channel) }))}
              onChange={(e) =>
                setDraft((d) => ({ ...d, channel: (e.target.value || null) as OrderFiltersValue["channel"] }))
              }
            />
          </FormField>

          <FormField
            label="orders.filters.paymentStatus"
            hint="orders.filters.paymentStatusHint"
            htmlFor="order-filter-payment"
          >
            <Select
              id="order-filter-payment"
              data-testid={fieldTestSelector("order-filter-payment")}
              placeholder={t("paymentStatusAll")}
              value={draft.paymentStatus ?? ""}
              options={PAYMENT_STATUSES.map((status) => ({ value: status, label: tPayment(status) }))}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  paymentStatus: (e.target.value || null) as OrderFiltersValue["paymentStatus"],
                }))
              }
            />
          </FormField>

          <FormField label="orders.filters.dateRange" hint="orders.filters.dateRangeHint" htmlFor="order-filter-dates">
            <DateRangePicker
              id="order-filter-dates"
              data-testid={fieldTestSelector("order-filter-dates")}
              label={t("dateRange")}
              value={{ from: draft.dateFrom, to: draft.dateTo }}
              onChange={(range) => setDraft((d) => ({ ...d, dateFrom: range.from, dateTo: range.to }))}
            />
          </FormField>

          <FormField label="orders.filters.quickSale" hint="orders.filters.quickSaleHint" htmlFor="order-filter-quick-sale">
            <Switch
              id="order-filter-quick-sale"
              data-testid={fieldTestSelector("order-filter-quick-sale")}
              label={t("quickSale")}
              hideLabel
              checked={draft.hasQuickSale}
              onCheckedChange={(hasQuickSale) => setDraft((d) => ({ ...d, hasQuickSale }))}
            />
          </FormField>
        </div>
      </Drawer>
    </>
  );
}

interface OrderFilterChipsProps {
  value: OrderFiltersValue;
  onChange: (value: OrderFiltersValue) => void;
}

export function OrderFilterChips({ value, onChange }: OrderFilterChipsProps) {
  const t = useTranslations("orders.filters");
  const tStatus = useTranslations("orders.status");
  const tChannel = useTranslations("orders.channel");
  const tPayment = useTranslations("orders.paymentStatus");
  const locale = useLocale();

  if (countOrderFilters(value) === 0) return null;

  // Date inputs are calendar days; read them as local midnight so the chip shows the day picked.
  const day = (date: string) => formatDate(`${date}T00:00:00`, locale);
  const chips: { key: string; label: string; clear: OrderFiltersValue }[] = [];
  if (value.status) {
    chips.push({ key: "status", label: t("chipStatus", { name: tStatus(value.status) }), clear: { ...value, status: null } });
  }
  if (value.channel) {
    chips.push({
      key: "channel",
      label: t("chipChannel", { name: tChannel(value.channel) }),
      clear: { ...value, channel: null },
    });
  }
  if (value.paymentStatus) {
    chips.push({
      key: "payment",
      label: t("chipPayment", { name: tPayment(value.paymentStatus) }),
      clear: { ...value, paymentStatus: null },
    });
  }
  if (value.dateFrom || value.dateTo) {
    const label =
      value.dateFrom && value.dateTo
        ? t("chipDates", { from: day(value.dateFrom), to: day(value.dateTo) })
        : value.dateFrom
          ? t("chipDateFrom", { date: day(value.dateFrom) })
          : t("chipDateTo", { date: day(value.dateTo) });
    chips.push({ key: "dates", label, clear: { ...value, dateFrom: "", dateTo: "" } });
  }
  if (value.hasQuickSale) {
    chips.push({ key: "quick-sale", label: t("chipQuickSale"), clear: { ...value, hasQuickSale: false } });
  }

  return (
    <ChipGroup data-testid="order-filter-chips">
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          data-testid={`order-filter-chip-${chip.key}`}
          onRemove={() => onChange(chip.clear)}
          removeLabel={t("removeFilter", { name: chip.label })}
        >
          {chip.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}

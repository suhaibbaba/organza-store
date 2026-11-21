"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button, Drawer, FormField, Input, Select } from "@store/ui";
import { ORDER_CHANNELS, ORDER_STATUSES, PAYMENT_STATUSES } from "@organza/shared/constants/order";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { DEFAULT_ORDER_FILTERS } from "@/constants/orders";
import type { OrderListFilters } from "@/types/order";

export interface OrderFiltersValue {
  status: OrderListFilters["status"];
  channel: OrderListFilters["channel"];
  paymentStatus: OrderListFilters["paymentStatus"];
  // Quick sell's review list (spec.md "Quick sell"): sales whose profit is still incomplete.
  hasQuickSale: boolean;
  dateFrom: string;
  dateTo: string;
}

interface OrderFiltersSheetProps {
  value: OrderFiltersValue;
  onApply: (value: OrderFiltersValue) => void;
  activeCount: number;
}

export function OrderFiltersSheet({ value, onApply, activeCount }: OrderFiltersSheetProps) {
  const t = useTranslations("orders.filters");
  const tStatus = useTranslations("orders.status");
  const tChannel = useTranslations("orders.channel");
  const tPayment = useTranslations("orders.paymentStatus");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  // Re-sync on open so reopening shows the applied filters, not an abandoned edit.
  function handleOpenChange(next: boolean) {
    if (next) setDraft(value);
    setOpen(next);
  }

  function handleApply() {
    onApply(draft);
    setOpen(false);
  }

  function handleReset() {
    const reset: OrderFiltersValue = {
      status: null,
      channel: null,
      paymentStatus: null,
      hasQuickSale: false,
      dateFrom: DEFAULT_ORDER_FILTERS.dateFrom,
      dateTo: DEFAULT_ORDER_FILTERS.dateTo,
    };
    setDraft(reset);
    onApply(reset);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => handleOpenChange(true)}
        data-test-selector="order-filters-open"
        className="relative shrink-0 px-4"
        icon={<SlidersHorizontal className="size-5" aria-hidden="true" />}
      >
        {t("trigger")}
        {activeCount > 0 && (
          <span className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-pill bg-primary-600 text-micro font-semibold text-ink-inverse">
            {activeCount}
          </span>
        )}
      </Button>

      <Drawer
        open={open}
        onOpenChange={handleOpenChange}
        title={t("title")}
        descriptionKey="orders.filters.title"
        data-testid="sheet-order-filters"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={handleReset} data-test-selector="order-filters-reset">
              {t("reset")}
            </Button>
            <Button type="button" onClick={handleApply} data-test-selector="order-filters-apply">
              {t("apply")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField label="orders.filters.status" htmlFor="order-filter-status">
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

          <FormField label="orders.filters.channel" htmlFor="order-filter-channel">
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

          <FormField label="orders.filters.paymentStatus" htmlFor="order-filter-payment">
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

          {/* A checkbox, not a two-option select: a quick sale is an ordinary sale otherwise, so "all" is the unfiltered list. */}
          <label
            htmlFor="order-filter-quick-sale"
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-line px-3 has-[input:checked]:border-selected-line has-[input:checked]:bg-selected"
          >
            <input
              id="order-filter-quick-sale"
              type="checkbox"
              checked={draft.hasQuickSale}
              onChange={(e) => setDraft((d) => ({ ...d, hasQuickSale: e.target.checked }))}
              data-test-selector="field-order-filter-quick-sale"
              className="size-5 shrink-0 accent-primary-600"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-label font-medium text-ink">{t("quickSale")}</span>
              <span className="text-micro text-ink-muted">{t("quickSaleHint")}</span>
            </span>
          </label>

          {/* Each date has its own visible label: an empty date input on a phone shows nothing to tell "from" from "to". */}
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 text-label font-medium text-ink">{t("dateRange")}</legend>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="orders.filters.dateFrom" htmlFor="order-filter-date-from">
                <Input
                  id="order-filter-date-from"
                  type="date"
                  dir="ltr"
                  data-test-selector={fieldTestSelector("order-filter-date-from")}
                  value={draft.dateFrom}
                  max={draft.dateTo || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
                />
              </FormField>

              <FormField label="orders.filters.dateTo" htmlFor="order-filter-date-to">
                <Input
                  id="order-filter-date-to"
                  type="date"
                  dir="ltr"
                  data-test-selector={fieldTestSelector("order-filter-date-to")}
                  value={draft.dateTo}
                  min={draft.dateFrom || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
                />
              </FormField>
            </div>
          </fieldset>
        </div>
      </Drawer>
    </>
  );
}

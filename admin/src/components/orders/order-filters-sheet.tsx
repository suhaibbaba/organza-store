"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { ORDER_CHANNELS, ORDER_STATUSES, PAYMENT_STATUSES } from "@shared/constants/order";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DEFAULT_ORDER_FILTERS } from "@/constants/orders";
import type { OrderListFilters } from "@/types/order";

export interface OrderFiltersValue {
  status: OrderListFilters["status"];
  channel: OrderListFilters["channel"];
  paymentStatus: OrderListFilters["paymentStatus"];
  dateFrom: string;
  dateTo: string;
}

interface OrderFiltersSheetProps {
  value: OrderFiltersValue;
  onApply: (value: OrderFiltersValue) => void;
  activeCount: number;
}

// Status, channel and date range, in a sheet rather than a toolbar: on a
// phone there is no room for four controls next to the search box, and
// filtering is an occasional action while searching is the constant one.
export function OrderFiltersSheet({ value, onApply, activeCount }: OrderFiltersSheetProps) {
  const t = useTranslations("orders.filters");
  const tStatus = useTranslations("orders.status");
  const tChannel = useTranslations("orders.channel");
  const tPayment = useTranslations("orders.paymentStatus");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  // Re-sync the draft with the applied filters on open, so reopening after
  // Apply/Reset reflects the current state rather than a stale in-progress
  // edit.
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
      dateFrom: DEFAULT_ORDER_FILTERS.dateFrom,
      dateTo: DEFAULT_ORDER_FILTERS.dateTo,
    };
    setDraft(reset);
    onApply(reset);
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => handleOpenChange(true)} className="relative shrink-0 px-4">
        <SlidersHorizontal className="size-5" aria-hidden="true" />
        {t("trigger")}
        {activeCount > 0 && (
          <span className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="end" closeLabel={tCommon("close")}>
          <SheetHeader>
            <SheetTitle>{t("title")}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="order-filter-status">{t("status")}</Label>
              <Select
                id="order-filter-status"
                value={draft.status ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: (e.target.value || null) as OrderFiltersValue["status"] }))
                }
              >
                <option value="">{t("statusAll")}</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {tStatus(status)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="order-filter-channel">{t("channel")}</Label>
              <Select
                id="order-filter-channel"
                value={draft.channel ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, channel: (e.target.value || null) as OrderFiltersValue["channel"] }))
                }
              >
                <option value="">{t("channelAll")}</option>
                {ORDER_CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {tChannel(channel)}
                  </option>
                ))}
              </Select>
            </div>

            {/* Whether the money has arrived — the shop's other daily
                question about an order, alongside where the goods are. */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="order-filter-payment">{t("paymentStatus")}</Label>
              <Select
                id="order-filter-payment"
                value={draft.paymentStatus ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    paymentStatus: (e.target.value || null) as OrderFiltersValue["paymentStatus"],
                  }))
                }
              >
                <option value="">{t("paymentStatusAll")}</option>
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {tPayment(status)}
                  </option>
                ))}
              </Select>
            </div>

            {/* Two dates, each with its OWN visible label. An empty date
                input renders as an empty box on a phone — no "yyyy-mm-dd"
                hint, nothing — so two of them stacked were two identical
                blanks with no way to tell which one was "from". An aria-label
                answered that for a screen reader only, which is the one
                reader who wasn't confused. Same shape as the reports range
                picker, so the two screens read alike.
                They also used to push the sheet sideways on a phone; that is
                fixed once for every date field in components/ui/input.tsx. */}
            <div className="flex min-w-0 flex-col gap-2">
              <Label>{t("dateRange")}</Label>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor="order-filter-date-from" className="text-muted-foreground">
                    {t("dateFrom")}
                  </Label>
                  {/* A native date input gets the OS date picker on a phone —
                      no calendar library, no typing a format wrong. dir="ltr"
                      keeps the y/m/d segments in their expected order inside
                      an RTL page. */}
                  <Input
                    id="order-filter-date-from"
                    type="date"
                    dir="ltr"
                    value={draft.dateFrom}
                    max={draft.dateTo || undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
                  />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor="order-filter-date-to" className="text-muted-foreground">
                    {t("dateTo")}
                  </Label>
                  <Input
                    id="order-filter-date-to"
                    type="date"
                    dir="ltr"
                    value={draft.dateTo}
                    min={draft.dateFrom || undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 p-5 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleReset}>
              {t("reset")}
            </Button>
            <Button type="button" className="flex-1" onClick={handleApply}>
              {t("apply")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

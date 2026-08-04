"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";
import { ERROR_CODES } from "@shared/constants/errors";
import type { Order } from "@shared/types/order";
import { useReturnOrderMutation } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { localize } from "@/lib/i18n-content";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Spinner } from "@/components/ui/spinner";
import type { ReturnQuantities } from "@/types/order";

interface OrderReturnSheetProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Taking goods back, in whole or in part (spec.md "Returns"). Stock is
// restored by the backend inside its transaction — nothing here touches
// quantities directly.
//
// Two ways through, because both happen: "the customer sent everything back"
// is one tap, and "she kept the black one" is a quantity per line.
export function OrderReturnSheet({ order, open, onOpenChange }: OrderReturnSheetProps) {
  const tCommon = useTranslations("common");
  const t = useTranslations("orders.detail.returns");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={tCommon("close")}>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        {/* Keyed by order so the quantities start fresh each time the sheet
            opens rather than showing what was last typed and abandoned. */}
        <ReturnForm key={order.id} order={order} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function ReturnForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const t = useTranslations("orders.detail.returns");
  const locale = useLocale();
  const translateError = useTranslateError();
  const mutation = useReturnOrderMutation(order.id);
  const [quantities, setQuantities] = useState<ReturnQuantities>({});

  // What each line still has outstanding — a line already returned in full
  // can't be returned again, and the backend refuses the attempt anyway
  // (ORDER_RETURN_QUANTITY_EXCEEDED).
  const returnable = useMemo(
    () =>
      order.items
        .map((item) => ({ item, outstanding: item.quantity - item.returnedQuantity }))
        .filter((entry) => entry.outstanding > 0),
    [order.items]
  );

  const selectedCount = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);

  function setQuantity(itemId: string, quantity: number) {
    setQuantities((current) => ({ ...current, [itemId]: quantity }));
  }

  function submitWholeOrder() {
    // No `items` means "all of it" — every line, in whatever quantity is
    // still outstanding (see the backend's return route).
    mutation.mutate({}, { onSuccess: onDone });
  }

  function submitSelected() {
    const items = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (items.length === 0) return;
    mutation.mutate({ items }, { onSuccess: onDone });
  }

  if (returnable.length === 0) {
    return (
      <div className="px-5 pb-5">
        <Alert>{t("nothingLeft")}</Alert>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
      <p className="text-sm text-muted-foreground">{t("description")}</p>

      {mutation.isError && (
        <Alert variant="destructive">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
        </Alert>
      )}

      <Button
        type="button"
        variant="destructive"
        className="h-14 w-full text-base"
        disabled={mutation.isPending}
        onClick={submitWholeOrder}
      >
        {mutation.isPending ? <Spinner /> : <Undo2 className="size-5 rtl:-scale-x-100" aria-hidden="true" />}
        {t("returnWholeOrder")}
      </Button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("or")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-foreground">{t("pickItems")}</p>

        {returnable.map(({ item, outstanding }) => {
          const name = localize(item.name, locale);
          const variantName = item.variantName ? localize(item.variantName, locale) : null;
          const label = variantName ? `${name} — ${variantName}` : name;

          return (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{name}</p>
                {variantName && <p className="truncate text-xs text-muted-foreground">{variantName}</p>}
                <p className="text-xs text-muted-foreground">{t("outstanding", { count: outstanding })}</p>
              </div>
              <QuantityStepper
                value={quantities[item.id] ?? 0}
                // 0 = this line isn't part of the return.
                min={0}
                max={outstanding}
                onChange={(quantity) => setQuantity(item.id, quantity)}
                decreaseLabel={t("decrease", { name: label })}
                increaseLabel={t("increase", { name: label })}
                valueLabel={t("quantityFor", { name: label })}
                className="shrink-0"
              />
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="destructive"
        className="mt-auto h-14 w-full text-base"
        disabled={mutation.isPending || selectedCount === 0}
        onClick={submitSelected}
      >
        {mutation.isPending && <Spinner />}
        {t("returnSelected", { count: selectedCount })}
      </Button>
    </div>
  );
}

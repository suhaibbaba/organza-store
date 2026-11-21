"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";
import { Alert, Button, Drawer, Typography } from "@store/ui";
import { ERROR_CODES } from "@store/shared/constants/errors";
import type { Order } from "@store/shared/types/order";
import { useReturnOrderMutation } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { localize } from "@/lib/i18n-content";
import { ApiError } from "@/lib/api/errors";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import type { ReturnQuantities } from "@/types/order";

interface OrderReturnSheetProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Whole or partial return (spec.md "Returns"); stock is restored by the backend inside its transaction.
export function OrderReturnSheet({ order, open, onOpenChange }: OrderReturnSheetProps) {
  const t = useTranslations("orders.detail.returns");

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      descriptionKey="orders.detail.returns.description"
      data-testid="sheet-order-return"
    >
      {/* Keyed by order so quantities start fresh each time rather than showing an abandoned edit. */}
      <ReturnForm key={order.id} order={order} onDone={() => onOpenChange(false)} />
    </Drawer>
  );
}

function ReturnForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const t = useTranslations("orders.detail.returns");
  const locale = useLocale();
  const translateError = useTranslateError();
  const mutation = useReturnOrderMutation(order.id);
  const [quantities, setQuantities] = useState<ReturnQuantities>({});

  // A line already returned in full can't be returned again (backend: ORDER_RETURN_QUANTITY_EXCEEDED).
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
    // No `items` means every line, in whatever quantity is still outstanding.
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
      <Alert tone="neutral" data-testid="alert-default">
        {t("nothingLeft")}
      </Alert>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4">
      <Typography variant="small" tone="muted">{t("description")}</Typography>

      {mutation.isError && (
        <Alert tone="danger" data-testid="alert-destructive">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
        </Alert>
      )}

      <Button
        type="button"
        variant="danger"
        className="w-full"
        isLoading={mutation.isPending}
        onClick={submitWholeOrder}
        icon={<Undo2 className="size-5 rtl:-scale-x-100" aria-hidden="true" />}
      >
        {t("returnWholeOrder")}
      </Button>

      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="h-px flex-1 bg-line" />
        <Typography variant="caption" tone="muted">{t("or")}</Typography>
        <div aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>

      <div className="flex flex-col gap-3">
        <Typography variant="small" weight="medium">{t("pickItems")}</Typography>

        {returnable.map(({ item, outstanding }) => {
          const name = localize(item.name, locale);
          const variantName = item.variantName ? localize(item.variantName, locale) : null;
          const label = variantName ? `${name} — ${variantName}` : name;

          return (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-panel border border-line p-3">
              <div className="min-w-0">
                <Typography variant="small" weight="medium" className="truncate">{name}</Typography>
                {variantName && <Typography variant="caption" tone="muted" as="p" className="truncate">{variantName}</Typography>}
                <Typography variant="caption" tone="muted" as="p">{t("outstanding", { count: outstanding })}</Typography>
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
        variant="danger"
        className="mt-auto w-full"
        isLoading={mutation.isPending}
        disabled={selectedCount === 0}
        onClick={submitSelected}
      >
        {t("returnSelected", { count: selectedCount })}
      </Button>
    </div>
  );
}

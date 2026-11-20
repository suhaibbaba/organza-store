"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2, Zap } from "lucide-react";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { SCAN_FLASH_MS } from "@/constants/pos";
import { SELL_CART_THUMB_SIZES } from "@/constants/images";
import { useDiscountLabel } from "@/hooks/use-discount-label";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { lineTotal } from "@/lib/cart";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { ProductThumb } from "@/components/sell/product-thumb";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { CONTROL_HEIGHT, CONTROL_SIZE } from "@/components/sell/screen/control-styles";
import type { CartLine as CartLineData } from "@/types/cart";
import type { ScanFlash } from "@/types/feedback";

interface CartLineProps {
  line: CartLineData;
  // Set for the line a scan just landed on (hooks/use-scan-flash.ts).
  flash: ScanFlash | null;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

// A variant's name is its option values joined by " / " (backend
// lib/variantCombo.ts) — "M / أخضر" — and the design draws each value as a
// chip of its own.
const VARIANT_NAME_SEPARATOR = " / ";

// One line of the sale: photo, name, the chosen options as chips, the
// quantity stepper, delete, and what the line comes to.
export function CartLine({ line, flash, onQuantityChange, onRemove }: CartLineProps) {
  const t = useTranslations("sell");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const discountLabel = useDiscountLabel();

  // Taking a line off the sale is asked about, inside the line — never in a
  // dialog over the counter. Held as the quantity it was asked at, so a scan
  // of the same piece while it is open withdraws the question.
  const [confirmingAt, setConfirmingAt] = useState<number | null>(null);
  const confirmingRemove = confirmingAt === line.quantity;

  const name = localize(line.name, locale);
  const variantName = line.variantName ? localize(line.variantName, locale) : null;
  const fullName = variantName ? `${name} — ${variantName}` : name;
  const chips = variantName ? variantName.split(VARIANT_NAME_SEPARATOR).filter(Boolean) : [];
  const appliedDiscount = discountLabel(line.discountType, line.discountValue);

  return (
    <li
      className={cn(
        "relative flex flex-col gap-2 border-b border-border py-3 transition-colors last:border-b-0",
        flash && "-mx-2 rounded-control bg-pale px-2"
      )}
      data-test-selector={testSelectorFor("pos-cart-line", line.key)}
    >
      <div className="flex items-start gap-3">
        <ProductThumb
          src={line.imageUrl}
          alt={name}
          sizes={SELL_CART_THUMB_SIZES}
          className="size-13 rounded-[10px] bg-soft"
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="w-full truncate text-sm font-bold">{name}</span>
          {(chips.length > 0 || line.quickSell) && (
            <span className="flex flex-wrap gap-1">
              {line.quickSell && (
                <span className="inline-flex items-center gap-1 rounded-md bg-quick px-1.5 text-xs text-quick-foreground">
                  <Zap className="size-3" aria-hidden="true" />
                  {t("cart.quickSold")}
                </span>
              )}
              {chips.map((chip) => (
                <span key={chip} className="rounded-md bg-soft px-1.5 text-xs text-muted-foreground">
                  {chip}
                </span>
              ))}
            </span>
          )}
          {appliedDiscount && (
            <span className="text-xs font-medium text-primary">{t("cart.discountValue", { value: appliedDiscount })}</span>
          )}
          <div className="mt-1 flex w-full items-center gap-2">
            <QuantityStepper
              size="compact"
              name={line.key}
              value={line.quantity}
              max={line.availableStock}
              onChange={(quantity) => {
                setConfirmingAt(null);
                onQuantityChange(quantity);
              }}
              onBelowMin={() => setConfirmingAt(line.quantity)}
              itemLabel={fullName}
            />
            <button
              type="button"
              onClick={() => setConfirmingAt(line.quantity)}
              aria-label={t("cart.remove", { name: fullName })}
              data-test-selector={testSelectorFor("pos-cart-line-remove", line.key)}
              className={cn(
                CONTROL_SIZE,
                "hit-area flex shrink-0 items-center justify-center rounded-control border border-border text-muted-foreground transition-colors",
                "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
            <span className="ms-auto text-base font-bold tabular-nums">{formatMoney(lineTotal(line))}</span>
          </div>
        </div>
      </div>

      {confirmingRemove && (
        <div
          role="group"
          aria-label={t("cart.removeConfirmTitle")}
          data-test-selector={testSelectorFor("pos-cart-line-remove-confirm", line.key)}
          className="flex flex-wrap items-center gap-2 rounded-control border border-destructive/40 bg-destructive/5 p-2"
        >
          <p className="min-w-0 flex-1 text-sm font-medium">{t("cart.removeConfirmTitle")}</p>
          <button
            type="button"
            onClick={() => setConfirmingAt(null)}
            className={cn(CONTROL_HEIGHT, "rounded-control border border-border bg-card px-3 text-sm font-medium hover:bg-soft")}
          >
            {t("cart.removeConfirmKeep")}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className={cn(CONTROL_HEIGHT, "rounded-control bg-destructive px-3 text-sm font-semibold text-destructive-foreground hover:opacity-90")}
          >
            {t("cart.removeConfirmYes")}
          </button>
        </div>
      )}

      {/* The read, acknowledged: drains over the window in which the same
          barcode is ignored (use-scan-flash). */}
      {flash && (
        <span
          key={flash.token}
          className="animate-scan-flash-bar absolute bottom-0 start-0 h-1 w-full rounded-full bg-primary"
          style={{ animationDuration: `${SCAN_FLASH_MS}ms` }}
          aria-hidden="true"
        />
      )}
    </li>
  );
}

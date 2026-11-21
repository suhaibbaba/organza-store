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
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { Button } from "@store/ui";
import { CONTROL_HEIGHT } from "@/components/sell/screen/control-styles";
import type { CartLine as CartLineData } from "@/types/cart";
import type { ScanFlash } from "@/types/feedback";

interface CartLineProps {
  line: CartLineData;
  // Set for the line a scan just landed on (hooks/use-scan-flash.ts).
  flash: ScanFlash | null;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

// A variant's name is its option values joined by " / " (backend lib/variantCombo.ts); each is drawn as a chip.
const VARIANT_NAME_SEPARATOR = " / ";

export function CartLine({ line, flash, onQuantityChange, onRemove }: CartLineProps) {
  const t = useTranslations("sell");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const discountLabel = useDiscountLabel();

  // Removal is confirmed inside the line, keyed to the quantity asked at, so a scan of the same piece withdraws the question.
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
        "relative flex flex-col gap-2 border-b border-line py-3 transition-colors last:border-b-0",
        flash && "-mx-2 rounded-control bg-primary-50 px-2"
      )}
      data-test-selector={testSelectorFor("pos-cart-line", line.key)}
    >
      <div className="flex items-start gap-3">
        <ProductThumb
          src={line.imageUrl}
          alt={name}
          sizes={SELL_CART_THUMB_SIZES}
          className="size-13 rounded-photo bg-sunken"
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="w-full truncate text-label font-semibold text-ink">{name}</span>
          {(chips.length > 0 || line.quickSell) && (
            <span className="flex flex-wrap gap-1">
              {line.quickSell && (
                <span className="inline-flex items-center gap-1 rounded-chip border border-warning-300 bg-warning-50 px-1.5 text-micro text-warning-800">
                  <Zap className="size-3" aria-hidden="true" />
                  {t("cart.quickSold")}
                </span>
              )}
              {chips.map((chip) => (
                <span key={chip} className="rounded-chip bg-inset px-1.5 text-micro text-ink-muted">
                  {chip}
                </span>
              ))}
            </span>
          )}
          {appliedDiscount && (
            <span className="text-micro font-medium text-success-700">{t("cart.discountValue", { value: appliedDiscount })}</span>
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
              // Matches the 40px stepper beside it; hit-area keeps 44px.
              className={cn(
                "hit-area flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control border border-line bg-surface text-ink-muted transition-colors",
                "hover:border-danger-500 hover:bg-danger-50 hover:text-danger-600 focus-visible:border-danger-600 focus-visible:bg-danger-100 focus-visible:text-danger-700"
              )}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
            <span className="ms-auto text-section font-bold text-ink tabular-nums">{formatMoney(lineTotal(line))}</span>
          </div>
        </div>
      </div>

      {confirmingRemove && (
        <div
          role="group"
          aria-label={t("cart.removeConfirmTitle")}
          data-test-selector={testSelectorFor("pos-cart-line-remove-confirm", line.key)}
          className="flex flex-wrap items-center gap-2 rounded-control border border-danger-200 bg-danger-50 p-2"
        >
          <p className="min-w-0 flex-1 text-label font-medium text-ink">{t("cart.removeConfirmTitle")}</p>
          <Button variant="secondary" onClick={() => setConfirmingAt(null)} className={cn(CONTROL_HEIGHT, "px-3")}>
            {t("cart.removeConfirmKeep")}
          </Button>
          <Button variant="danger" onClick={onRemove} className={cn(CONTROL_HEIGHT, "px-3 font-semibold")}>
            {t("cart.removeConfirmYes")}
          </Button>
        </div>
      )}

      {/* Drains over the window in which the same barcode is ignored (use-scan-flash). */}
      {flash && (
        <span
          key={flash.token}
          className="animate-scan-flash-bar absolute bottom-0 start-0 h-1 w-full rounded-pill bg-primary-600"
          style={{ animationDuration: `${SCAN_FLASH_MS}ms` }}
          aria-hidden="true"
        />
      )}
    </li>
  );
}

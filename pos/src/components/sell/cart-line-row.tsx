"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Percent, Trash2 } from "lucide-react";
import { localize } from "@/lib/i18n-content";
import { lineDiscountCents, lineTotal } from "@/lib/cart";
import { fromCents, toCents } from "@/lib/money";
import { useDiscountLabel } from "@/hooks/use-discount-label";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { SCAN_FLASH_MS } from "@/constants/pos";
import { ProductThumb } from "@/components/sell/product-thumb";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { StockBadge } from "@/components/ui/stock-badge";
import { cn } from "@/lib/utils";
import type { CartLine } from "@/types/cart";
import type { ScanFlash } from "@/types/feedback";

interface CartLineRowProps {
  line: CartLine;
  // Set for the line a scan just landed on — see hooks/use-scan-flash.ts.
  flash: ScanFlash | null;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onDiscountClick: () => void;
}

// One sold line, as a card — never a table row. On a phone a table would
// either scroll sideways or shrink the controls below thumb size (CLAUDE.md
// "Frontend UX"), and this row carries three separate controls.
export function CartLineRow({ line, flash, onQuantityChange, onRemove, onDiscountClick }: CartLineRowProps) {
  const t = useTranslations("sell.cart");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const discountLabel = useDiscountLabel();

  // Taking a line off the sale is the one destructive thing on this card, and
  // it is one tap away from the quantity control beside it. So it is asked
  // about — never on an ordinary decrement, only at the moment the line would
  // actually go — and the question sits inside the card rather than in a
  // dialog over the counter: answering it costs one tap either way, and
  // nothing else on the screen stops working while it is up.
  //
  // Held as the quantity it was asked about rather than a plain flag, so the
  // question withdraws itself the moment the line changes under it: a scan of
  // the same tag while it is open makes this no longer the line that was about
  // to go, and a "remove" answered a second later would take away something
  // that had just been added.
  const [confirmingAt, setConfirmingAt] = useState<number | null>(null);
  const confirmingRemove = confirmingAt === line.quantity;

  function handleQuantityChange(quantity: number) {
    setConfirmingAt(null);
    onQuantityChange(quantity);
  }

  const name = localize(line.name, locale);
  const variantName = line.variantName ? localize(line.variantName, locale) : null;
  const fullName = variantName ? `${name} — ${variantName}` : name;
  const discountCents = lineDiscountCents(line);
  const appliedDiscount = discountLabel(line.discountType, line.discountValue);
  const isFlatAndExact = line.discountType === "AMOUNT" && discountCents === toCents(line.discountValue);

  return (
    <li
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-3 transition-colors",
        flash ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <ProductThumb src={line.imageUrl} alt={name} className="size-14 rounded-lg" />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-medium">{name}</span>
          {variantName && <span className="truncate text-sm text-muted-foreground">{variantName}</span>}
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("unitPrice", { price: formatMoney(line.unitPrice) })}
            </span>
            {/* What the shop still has of this piece, in the same red / amber
                / green as the search result the cashier picked it from. It
                belongs on the line and not only on the way in: a cart sits
                open while the customer decides, and "there is only one left"
                is exactly what somebody asking for a second one needs to
                hear. The count is what the stepper is capped at, so the two
                always agree. */}
            <StockBadge stock={line.availableStock} trackLowStock={line.trackLowStock} showCount />
          </span>

          {/* Right under the price, because that is the number it changes:
              what was applied AND what it comes to. The button below can
              only ever hold one of the two.

              A flat discount is usually its own answer ("5 ₪ off" takes 5 ₪
              off), so saying it twice would just be noise — the money is
              spelled out only when it differs, which is a percentage, or a
              flat amount clamped down to what the line was worth. */}
          {appliedDiscount && (
            <span className="text-sm font-medium text-primary">
              {isFlatAndExact
                ? t("discountValue", { value: appliedDiscount })
                : t("discountApplied", {
                    value: appliedDiscount,
                    amount: formatMoney(fromCents(discountCents)),
                  })}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setConfirmingAt(line.quantity)}
          aria-label={t("remove", { name: fullName })}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <QuantityStepper
          value={line.quantity}
          max={line.availableStock}
          onChange={handleQuantityChange}
          // One below a single piece is not a quantity, it is a removal —
          // so it asks instead of applying. The line never sits at zero in
          // between: it is either still here at one, or gone.
          onBelowMin={() => setConfirmingAt(line.quantity)}
          itemLabel={fullName}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscountClick}
            aria-label={t("discountFor", { name: fullName })}
            className="flex h-11 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Percent className="size-4" aria-hidden="true" />
            {/* The value, not the money: the money is on the line above,
                and this button is how you change the value. */}
            {appliedDiscount ?? t("addDiscount")}
          </button>

          <span className="min-w-20 text-end text-lg font-semibold tabular-nums">
            {formatMoney(lineTotal(line))}
          </span>
        </div>
      </div>

      {line.quantity >= line.availableStock && (
        <p className="text-xs text-muted-foreground">{t("stockCap", { count: line.availableStock })}</p>
      )}

      {confirmingRemove && (
        <div
          role="group"
          aria-label={t("removeConfirmTitle")}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2"
        >
          <p className="min-w-0 flex-1 text-sm font-medium">{t("removeConfirmTitle")}</p>
          <button
            type="button"
            onClick={() => setConfirmingAt(null)}
            className="h-11 rounded-lg border border-input px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("removeConfirmKeep")}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="h-11 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("removeConfirmYes")}
          </button>
        </div>
      )}

      {/* The read, acknowledged: a bar along the bottom of the line that
          drains over exactly the window in which this same barcode is
          ignored. Keyed by the flash token so scanning the same item again
          restarts it instead of leaving a finished bar sitting there. */}
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

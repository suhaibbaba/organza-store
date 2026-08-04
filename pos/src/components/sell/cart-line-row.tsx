"use client";

import { useLocale, useTranslations } from "next-intl";
import { Percent, Trash2 } from "lucide-react";
import { localize } from "@/lib/i18n-content";
import { lineDiscountCents, lineTotal } from "@/lib/cart";
import { fromCents } from "@/lib/money";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ProductThumb } from "@/components/sell/product-thumb";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import type { CartLine } from "@/types/cart";

interface CartLineRowProps {
  line: CartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onDiscountClick: () => void;
}

// One sold line, as a card — never a table row. On a phone a table would
// either scroll sideways or shrink the controls below thumb size (CLAUDE.md
// "Frontend UX"), and this row carries three separate controls.
export function CartLineRow({ line, onQuantityChange, onRemove, onDiscountClick }: CartLineRowProps) {
  const t = useTranslations("sell.cart");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const name = localize(line.name, locale);
  const variantName = line.variantName ? localize(line.variantName, locale) : null;
  const fullName = variantName ? `${name} — ${variantName}` : name;
  const discountCents = lineDiscountCents(line);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <ProductThumb src={line.imageUrl} alt={name} className="size-14 rounded-lg" />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-medium">{name}</span>
          {variantName && <span className="truncate text-sm text-muted-foreground">{variantName}</span>}
          <span className="text-sm text-muted-foreground">
            {t("unitPrice", { price: formatMoney(line.unitPrice) })}
          </span>
        </div>

        <button
          type="button"
          onClick={onRemove}
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
          onChange={onQuantityChange}
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
            {discountCents > 0 ? `−${formatMoney(fromCents(discountCents))}` : t("addDiscount")}
          </button>

          <span className="min-w-20 text-end text-lg font-semibold tabular-nums">
            {formatMoney(lineTotal(line))}
          </span>
        </div>
      </div>

      {line.quantity >= line.availableStock && (
        <p className="text-xs text-muted-foreground">{t("stockCap", { count: line.availableStock })}</p>
      )}
    </li>
  );
}

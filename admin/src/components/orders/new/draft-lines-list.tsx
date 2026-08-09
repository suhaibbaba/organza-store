"use client";

import { useLocale, useTranslations } from "next-intl";
import { Tag, Trash2 } from "lucide-react";
import { localize } from "@/lib/i18n-content";
import { lineDiscountCents, lineTotal } from "@/lib/order-draft";
import { fromCents, toCents } from "@/lib/money";
import { MIN_ORDER_QUANTITY } from "@/constants/orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { ProductImage } from "@/components/products/product-image";
import type { OrderDraft } from "@/hooks/use-order-draft";

interface DraftLinesListProps {
  draft: OrderDraft;
  onLineDiscountClick: (key: string) => void;
}

// What is going on the order so far. Each line carries its own quantity,
// discount and remove control, all at thumb size — there is no separate
// "edit line" screen to get lost in.
export function DraftLinesList({ draft, onLineDiscountClick }: DraftLinesListProps) {
  const t = useTranslations("orders.new.lines");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  if (draft.isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {draft.lines.map((line) => {
        const name = localize(line.name, locale);
        const variantName = line.variantName ? localize(line.variantName, locale) : null;
        const label = variantName ? `${name} — ${variantName}` : name;
        const hasDiscount = line.discountType !== null && line.discountValue !== null;
        const discountCents = lineDiscountCents(line);
        // What was applied, written the way its own type is written: a
        // percentage as a percentage, a flat sum in the shop's currency (from
        // Settings, via the money formatter). Never a percent sign over an
        // amount.
        const appliedDiscount = hasDiscount
          ? line.discountType === "PERCENT"
            ? t("percentValue", { value: Number(line.discountValue) })
            : formatMoney(line.discountValue ?? "0")
          : null;
        // A percentage says nothing about the money until it is resolved
        // against the line, so the money is spelled out beside it. A flat sum
        // already is the money — unless it was clamped down to what the line
        // was worth, which is the one case worth spelling out too.
        const showResolvedAmount =
          hasDiscount &&
          (line.discountType === "PERCENT" || discountCents !== toCents(line.discountValue));

        return (
          <li key={line.key} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
            <div className="flex items-start gap-3">
              <ProductImage src={line.imageUrl} alt={name} className="size-14 shrink-0 rounded-lg" sizes="56px" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{name}</p>
                {variantName && <p className="truncate text-xs text-muted-foreground">{variantName}</p>}
                <p className="truncate text-xs text-muted-foreground">
                  {t("unitPrice", { price: formatMoney(line.unitPrice) })}
                </p>
                {/* Under the price, because that is the number it changes.
                    A percentage is shown with the money it comes to — "10%"
                    alone is not an amount anybody can check an order against. */}
                {appliedDiscount && (
                  <p className="truncate text-xs font-medium text-primary">
                    {showResolvedAmount
                      ? t("discountApplied", {
                          value: appliedDiscount,
                          amount: formatMoney(fromCents(discountCents)),
                        })
                      : t("discountValue", { value: appliedDiscount })}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => draft.removeLine(line.key)}
                aria-label={t("remove", { name: label })}
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
              <QuantityStepper
                value={line.quantity}
                min={MIN_ORDER_QUANTITY}
                // Never more than the shop holds — the backend re-checks
                // stock atomically when the order is saved.
                max={Math.max(MIN_ORDER_QUANTITY, line.availableStock)}
                onChange={(quantity) => draft.setQuantity(line.key, quantity)}
                decreaseLabel={t("decrease", { name: label })}
                increaseLabel={t("increase", { name: label })}
                valueLabel={t("quantityFor", { name: label })}
              />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onLineDiscountClick(line.key)}
                  aria-label={t("discountFor", { name: label })}
                  className={
                    hasDiscount
                      ? "flex min-h-11 items-center gap-1 rounded-lg border border-primary px-3 py-2 text-xs font-medium text-primary"
                      : "flex min-h-11 items-center gap-1 rounded-lg border border-input px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
                  }
                >
                  {/* A price tag, not a percent sign: the glyph names the
                      control, and it cannot know whether this discount is a
                      percentage or a flat sum. The text beside it does — it is
                      either "10%" or an amount in the shop's own currency. */}
                  <Tag className="size-4" aria-hidden="true" />
                  {appliedDiscount ?? t("addDiscount")}
                </button>
                <span className="w-20 shrink-0 text-end text-sm font-semibold tabular-nums text-foreground">
                  {formatMoney(lineTotal(line))}
                </span>
              </div>
            </div>

            {/* Why the + went dead. A disabled control with no explanation
                reads as a broken screen; the shop simply hasn't got another
                one of these. */}
            {line.quantity >= line.availableStock && (
              <p className="text-xs text-muted-foreground">{t("stockCap", { count: line.availableStock })}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

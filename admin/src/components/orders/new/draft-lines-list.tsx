"use client";

import { useLocale, useTranslations } from "next-intl";
import { Tag, Trash2 } from "lucide-react";
import { localize } from "@/lib/i18n-content";
import { lineDiscountCents, lineTotal } from "@/lib/order-draft";
import { fromCents, toCents } from "@/lib/money";
import { MIN_ORDER_QUANTITY } from "@/constants/orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { ProductImage } from "@/components/products/product-image";
import type { OrderDraft } from "@/hooks/use-order-draft";
import { testSelectorFor } from "@organza/shared/lib/testSelector";

interface DraftLinesListProps {
  draft: OrderDraft;
  onLineDiscountClick: (key: string) => void;
}

// Each line carries its own quantity, discount and remove control; there is no separate "edit line" screen.
export function DraftLinesList({ draft, onLineDiscountClick }: DraftLinesListProps) {
  const t = useTranslations("orders.new.lines");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  if (draft.isEmpty) {
    return (
      <div className="rounded-card border border-dashed border-line py-10 text-center">
        <p className="text-label text-ink-muted">{t("empty")}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" data-test-selector="order-draft-lines">
      {draft.lines.map((line) => {
        const name = localize(line.name, locale);
        const variantName = line.variantName ? localize(line.variantName, locale) : null;
        const label = variantName ? `${name} — ${variantName}` : name;
        const hasDiscount = line.discountType !== null && line.discountValue !== null;
        const discountCents = lineDiscountCents(line);
        // A percentage as a percentage, a flat sum in the shop's currency (from Settings).
        const appliedDiscount = hasDiscount
          ? line.discountType === "PERCENT"
            ? t("percentValue", { value: Number(line.discountValue) })
            : formatMoney(line.discountValue ?? "0")
          : null;
        // Spell the money out for a percentage, or for a flat sum clamped to what the line was worth.
        const showResolvedAmount =
          hasDiscount &&
          (line.discountType === "PERCENT" || discountCents !== toCents(line.discountValue));

        return (
          <li
            key={line.key}
            className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3 shadow-card"
            data-test-selector={testSelectorFor("order-draft-line", line.key)}
          >
            <div className="flex items-start gap-3">
              <ProductImage src={line.imageUrl} alt={name} className="size-14 shrink-0 rounded-control" sizes="56px" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-label font-medium text-ink">{name}</p>
                {variantName && <p className="truncate text-micro text-ink-muted">{variantName}</p>}
                <p className="truncate text-micro text-ink-muted">
                  {t("unitPrice", { price: formatMoney(line.unitPrice) })}
                </p>
                {appliedDiscount && (
                  <p className="truncate text-micro font-medium text-primary-600">
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
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-inset hover:text-danger-600 focus-visible:bg-danger-100 focus-visible:text-danger-700"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
              <QuantityStepper
                value={line.quantity}
                min={MIN_ORDER_QUANTITY}
                // Never more than the shop holds; the backend re-checks stock atomically on save.
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
                      ? "flex min-h-11 cursor-pointer items-center gap-1 rounded-control border border-selected-line bg-selected px-3 py-2 text-micro font-medium text-primary-600 focus-visible:bg-primary-200 focus-visible:text-primary-800"
                      : "flex min-h-11 cursor-pointer items-center gap-1 rounded-control border border-line-strong px-3 py-2 text-micro font-medium text-ink-muted transition-colors hover:bg-inset focus-visible:bg-neutral-200 focus-visible:text-ink"
                  }
                >
                  {/* A price tag, not a percent sign: the discount may be a percentage or a flat sum. */}
                  <Tag className="size-4" aria-hidden="true" />
                  {appliedDiscount ?? t("addDiscount")}
                </button>
                <span className="w-20 shrink-0 text-end text-label font-semibold tabular-nums text-ink">
                  {formatMoney(lineTotal(line))}
                </span>
              </div>
            </div>

            {/* Explains why + went dead: the shop has no more of this piece. */}
            {line.quantity >= line.availableStock && (
              <p className="text-micro text-ink-muted">{t("stockCap", { count: line.availableStock })}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

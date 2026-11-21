"use client";

import { useLocale, useTranslations } from "next-intl";
import { Tag, Trash2 } from "lucide-react";
import { Button, IconButton, Typography } from "@store/ui";
import { localize } from "@/lib/i18n-content";
import { lineDiscountCents, lineTotal } from "@/lib/order-draft";
import { fromCents, toCents } from "@/lib/money";
import { GIFT_LINE_TOTAL, MIN_ORDER_QUANTITY } from "@/constants/orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { ProductImage } from "@/components/products/product-image";
import type { OrderDraft } from "@/hooks/use-order-draft";
import { testSelectorFor } from "@organza/shared/lib/testSelector";

interface DraftLinesListProps {
  draft: OrderDraft;
  isGift: boolean;
  onLineDiscountClick: (key: string) => void;
}

// Each line carries its own quantity, discount and remove control; there is no separate "edit line" screen.
export function DraftLinesList({ draft, isGift, onLineDiscountClick }: DraftLinesListProps) {
  const t = useTranslations("orders.new.lines");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  if (draft.isEmpty) {
    return (
      <div className="rounded-panel border border-dashed border-line py-10 text-center">
        <Typography variant="small" tone="muted">{t("empty")}</Typography>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-panel border border-line" data-test-selector="order-draft-lines">
      {draft.lines.map((line) => {
        const name = localize(line.name, locale);
        const variantName = line.variantName ? localize(line.variantName, locale) : null;
        const label = variantName ? `${name} — ${variantName}` : name;
        const hasDiscount = !isGift && line.discountType !== null && line.discountValue !== null;
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
            className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
            data-test-selector={testSelectorFor("order-draft-line", line.key)}
          >
            <ProductImage src={line.imageUrl} alt={name} className="size-14 shrink-0 rounded-control" sizes="56px" />

            <div className="min-w-0 flex-1 basis-0 self-start sm:basis-40">
              <Typography variant="small" weight="medium">{name}</Typography>
              {variantName && <Typography variant="caption" tone="muted" as="p" className="truncate">{variantName}</Typography>}
              <Typography variant="caption" tone="muted" as="p" className="truncate">
                {t("unitPrice", { price: formatMoney(line.unitPrice) })}
              </Typography>
              {appliedDiscount && (
                <Typography variant="caption" tone="brand" weight="medium" as="p" className="truncate">
                  {showResolvedAmount
                    ? t("discountApplied", {
                        value: appliedDiscount,
                        amount: formatMoney(fromCents(discountCents)),
                      })
                    : t("discountValue", { value: appliedDiscount })}
                </Typography>
              )}
            </div>
            <IconButton
              label={t("remove", { name: label })}
              icon={<Trash2 aria-hidden="true" />}
              tone="danger"
              onClick={() => draft.removeLine(line.key)}
              data-testid={testSelectorFor("order-line-remove", line.key)}
              className="self-start sm:order-last"
            />

            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
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

              <div className="ms-auto flex min-w-0 items-center gap-1">
                {!isGift && (
                  // A price tag, not a percent sign: the discount may be a percentage or a flat sum.
                  <Button
                    variant={hasDiscount ? "ghost" : "secondary"}
                    icon={<Tag className="size-4 shrink-0" aria-hidden="true" />}
                    onClick={() => onLineDiscountClick(line.key)}
                    aria-label={t("discountFor", { name: label })}
                    data-testid={testSelectorFor("order-line-discount", line.key)}
                  >
                    {appliedDiscount ?? <span className="max-sm:sr-only">{t("addDiscount")}</span>}
                  </Button>
                )}
              </div>
            </div>

            <div
              className="flex w-full items-center justify-between gap-2 border-t border-line pt-2 sm:w-auto sm:border-0 sm:pt-0"
              data-test-selector="order-draft-line-total"
            >
              <Typography variant="caption" tone="muted" className="sm:sr-only">{t("lineTotal")}</Typography>
              <Typography variant="h2" weight="bold" as="span" className="tabular-nums">
                {formatMoney(isGift ? GIFT_LINE_TOTAL : lineTotal(line))}
              </Typography>
            </div>

            {/* Explains why + went dead: the shop has no more of this piece. */}
            {line.quantity >= line.availableStock && (
              <Typography variant="caption" tone="muted" as="p" className="w-full sm:order-last">
                {t("stockCap", { count: line.availableStock })}
              </Typography>
            )}
          </li>
        );
      })}
    </ul>
  );
}

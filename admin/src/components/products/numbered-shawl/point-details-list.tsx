"use client";

import { useTranslations } from "next-intl";
import { NumericInput } from "@/components/fields/numeric-input";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { formatMoney } from "@/lib/format";
import { parseQuantity } from "@/lib/validation/numeric";
import { isPlacedShawlPoint } from "@/lib/validation/numbered-shawl";
import type { ShawlPoint } from "@/types/numberedShawl";
import { testSelectorFor } from "@organza/shared/lib/testSelector";

interface PointDetailsListProps {
  points: ShawlPoint[];
  currency: string;
  locale: string;
  basePrice: string;
  onFieldChange: (id: string, field: "stock" | "priceOverride", value: string) => void;
}

// Quantity + optional price override per number; an empty price falls back to the product's own (rule 3).
export function PointDetailsList({ points, currency, locale, basePrice, onFieldChange }: PointDetailsListProps) {
  const t = useTranslations("products.form.numberedShawl");
  const tCommon = useTranslations("common");

  if (points.length === 0) {
    return <p className="text-label text-ink-muted">{t("noPointsYet")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {points.map((point) => {
        const pointName = t("pointLabel", { number: point.number });

        return (
          <div
            key={point.id}
            className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-3"
            data-test-selector={testSelectorFor("shawl-point-details", point.number)}
          >
            <div className="flex flex-col">
              <p className="text-label font-semibold text-ink">{pointName}</p>
              {/* Still editable, just not on the photo yet — said so it isn't taken for a mistake. */}
              {!isPlacedShawlPoint(point) && <p className="text-label text-ink-muted">{t("notPlaced")}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-ink">{t("stock")}</span>
              <QuantityStepper
                name={`shawl-point-${point.number}`}
                value={parseQuantity(point.stock)}
                onChange={(stock) => onFieldChange(point.id, "stock", String(stock))}
                decreaseLabel={tCommon("quantity.decrease", { name: pointName })}
                increaseLabel={tCommon("quantity.increase", { name: pointName })}
                valueLabel={tCommon("quantity.value", { name: pointName })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`shawl-price-${point.id}`} className="text-label font-medium text-ink">
                {t("priceOverride")}
              </label>
              <NumericInput
                id={`shawl-price-${point.id}`}
                allowDecimal
                placeholder={t("inherits", { value: formatMoney(basePrice, currency, locale) })}
                value={point.priceOverride}
                onChange={(e) => onFieldChange(point.id, "priceOverride", e.target.value)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

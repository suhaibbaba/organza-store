"use client";

import { useTranslations } from "next-intl";
import { NumericInput } from "@/components/ui/numeric-input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { parseQuantity } from "@/lib/validation/numeric";
import type { ShawlPoint } from "@/types/numberedShawl";
import { testSelectorFor } from "@organza/shared/lib/testSelector";

interface PointDetailsListProps {
  points: ShawlPoint[];
  currency: string;
  locale: string;
  basePrice: string;
  onFieldChange: (id: string, field: "stock" | "priceOverride", value: string) => void;
}

// Edit-mode step 2: quantity + optional price override per placed number
// (spec.md "Numbered shawls" — no sizes/colors, just Number + quantity).
// A brand-new point and an existing, unoverridden one both fall back to the
// product's own price (CLAUDE.md rule 3), so a single `basePrice` prop
// covers the placeholder for every row.
//
// One number per cell, its two fields stacked inside it. A shawl carries
// twenty or thirty numbers, and a full-width row each turned that into a
// scroll on any screen wider than a phone; the phone still gets exactly the
// one column it had.
export function PointDetailsList({ points, currency, locale, basePrice, onFieldChange }: PointDetailsListProps) {
  const t = useTranslations("products.form.numberedShawl");
  const tCommon = useTranslations("common");

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noPointsYet")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {points.map((point) => {
        const pointName = t("pointLabel", { number: point.number });

        return (
          <div
            key={point.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3"
            data-test-selector={testSelectorFor("shawl-point-details", point.number)}
          >
            <p className="text-sm font-semibold text-foreground">{pointName}</p>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t("stock")}</span>
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
              <Label htmlFor={`shawl-price-${point.id}`}>{t("priceOverride")}</Label>
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

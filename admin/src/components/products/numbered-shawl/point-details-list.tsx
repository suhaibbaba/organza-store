"use client";

import { useTranslations } from "next-intl";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import type { ShawlPoint } from "@/types/numberedShawl";

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
export function PointDetailsList({ points, currency, locale, basePrice, onFieldChange }: PointDetailsListProps) {
  const t = useTranslations("products.form.numberedShawl");

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noPointsYet")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {points.map((point) => (
        <div key={point.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
          <p className="text-sm font-semibold text-foreground">{t("pointLabel", { number: point.number })}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`shawl-stock-${point.id}`}>{t("stock")}</Label>
              <NumericInput
                id={`shawl-stock-${point.id}`}
                value={point.stock}
                onChange={(e) => onFieldChange(point.id, "stock", e.target.value)}
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
        </div>
      ))}
    </div>
  );
}

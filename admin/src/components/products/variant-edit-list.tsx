"use client";

import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import type { Variant } from "@shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantEditValues } from "@/types/productForm";

interface VariantEditListProps {
  variants: Variant[];
  currency: string;
  canSeeCost: boolean;
  edits: Record<string, VariantEditValues>;
  onEditChange: (variantId: string, values: VariantEditValues) => void;
  removedIds: Set<string>;
  onRemove: (variantId: string) => void;
  onRestore: (variantId: string) => void;
}

// Edit-mode only: existing variant rows, each editable in place. Name comes
// from the referenced option values (CLAUDE.md rule 2) and stays read-only
// here — rename the global value instead. Removing a row is staged locally
// (undo-able) and only sent as DELETE on final submit.
export function VariantEditList({
  variants,
  currency,
  canSeeCost,
  edits,
  onEditChange,
  removedIds,
  onRemove,
  onRestore,
}: VariantEditListProps) {
  const t = useTranslations("products.form.variants");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-2">
      {variants.map((variant) => {
        const name = localize(variant.name, locale);
        const values = edits[variant.id];
        const isRemoved = removedIds.has(variant.id);

        if (!values) return null;

        if (isRemoved) {
          return (
            <div
              key={variant.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border p-3"
            >
              <div>
                <p className="text-sm font-medium text-muted-foreground line-through">{name}</p>
                <p className="text-xs text-muted-foreground">{variant.sku}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onRestore(variant.id)}>
                {t("undo")}
              </Button>
            </div>
          );
        }

        return (
          <div key={variant.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{variant.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(variant.id)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={t("removeCombo")}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`stock-${variant.id}`}>{t("stock")}</Label>
                <Input
                  id={`stock-${variant.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={values.stock}
                  onChange={(e) => onEditChange(variant.id, { ...values, stock: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`price-${variant.id}`}>{t("priceOverride")}</Label>
                <Input
                  id={`price-${variant.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder={t("inherits", { value: formatMoney(variant.resolvedPrice, currency, locale) })}
                  value={values.priceOverride}
                  onChange={(e) => onEditChange(variant.id, { ...values, priceOverride: e.target.value })}
                />
              </div>

              {canSeeCost && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`cost-${variant.id}`}>{t("cost")}</Label>
                  <Input
                    id={`cost-${variant.id}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    placeholder={
                      variant.resolvedCost ? t("inherits", { value: formatMoney(variant.resolvedCost, currency, locale) }) : undefined
                    }
                    value={values.cost}
                    onChange={(e) => onEditChange(variant.id, { ...values, cost: e.target.value })}
                  />
                </div>
              )}

              <div className={cn("flex items-center justify-between gap-2 rounded-lg", !canSeeCost && "col-span-1")}>
                <Label htmlFor={`active-${variant.id}`}>{t("active")}</Label>
                <Switch
                  id={`active-${variant.id}`}
                  checked={values.isActive}
                  onCheckedChange={(checked) => onEditChange(variant.id, { ...values, isActive: checked })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

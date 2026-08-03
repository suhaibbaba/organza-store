"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Trash2 } from "lucide-react";
import type { Variant, VariantType } from "@shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/products/image-manager";
import { cn } from "@/lib/utils";
import type { VariantEditValues } from "@/types/productForm";

interface VariantEditListProps {
  variants: Variant[];
  // Needed to label each option value with the variant type it came from
  // (e.g. "اللون: أحمر"), so a value reads unambiguously as a colour, size or
  // number rather than a bare word.
  variantTypes: VariantType[];
  currency: string;
  canSeeCost: boolean;
  canEditDetails: boolean;
  canDeleteImages: boolean;
  edits: Record<string, VariantEditValues>;
  onEditChange: (variantId: string, values: VariantEditValues) => void;
  removedIds: Set<string>;
  onRemove: (variantId: string) => void;
  onRestore: (variantId: string) => void;
}

// Edit-mode only: existing variant rows, each editable in place. Name comes
// from the referenced option values (CLAUDE.md rule 2) and stays read-only
// here — rename the global value instead. Removing a row is staged locally
// (undo-able) and only sent as DELETE on final submit. Images are the
// exception: they're always shown and always live (immediate API calls),
// even for Employees who can't edit stock/price/cost (spec.md: "edit
// images" is its own, broader capability).
export function VariantEditList({
  variants,
  variantTypes,
  currency,
  canSeeCost,
  canEditDetails,
  canDeleteImages,
  edits,
  onEditChange,
  removedIds,
  onRemove,
  onRestore,
}: VariantEditListProps) {
  const t = useTranslations("products.form.variants");
  const tImages = useTranslations("products.form.images");
  const locale = useLocale();
  const [expandedImagesId, setExpandedImagesId] = useState<string | null>(null);

  // variantTypeId -> translated type name (e.g. "اللون", "المقاس", "الأرقام").
  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of variantTypes) map.set(type.id, localize(type.name, locale));
    return map;
  }, [variantTypes, locale]);

  // Each value tagged with the variant type it references, so the row shows
  // "اللون: أحمر" / "المقاس: M" instead of a bare "أحمر / M" that hides which
  // value is a colour vs a size (CLAUDE.md rule 2: the type is a reference).
  function labeledValues(variant: Variant): { key: string; typeName: string; value: string }[] {
    return variant.values.map((v) => ({
      key: v.id,
      typeName: typeNameById.get(v.variantTypeId) ?? "",
      value: localize(v.value, locale),
    }));
  }

  return (
    <div className="flex flex-col gap-2">
      {variants.map((variant) => {
        const name = localize(variant.name, locale);
        const groups = labeledValues(variant);
        const values = edits[variant.id];
        const isRemoved = removedIds.has(variant.id);
        const imagesOpen = expandedImagesId === variant.id;

        if (!values) return null;

        if (isRemoved) {
          return (
            <div
              key={variant.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border p-3"
            >
              <div className="min-w-0">
                {groups.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {groups.map((g) => (
                      <span key={g.key} className="text-sm font-medium text-muted-foreground line-through">
                        <span className="text-muted-foreground/70">{g.typeName}:</span> {g.value}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground line-through">{name}</p>
                )}
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
                {groups.length > 0 ? (
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {groups.map((g) => (
                      <span
                        key={g.key}
                        className="inline-flex items-baseline gap-1 rounded-md bg-secondary px-2 py-0.5 text-sm font-medium text-secondary-foreground"
                      >
                        <span className="text-xs text-muted-foreground">{g.typeName}:</span>
                        {g.value}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                )}
                <p className="mt-1 truncate text-xs text-muted-foreground">{variant.sku}</p>
              </div>
              {canEditDetails && (
                <button
                  type="button"
                  onClick={() => onRemove(variant.id)}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t("removeCombo")}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {canEditDetails && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`stock-${variant.id}`}>{t("stock")}</Label>
                  <NumericInput
                    id={`stock-${variant.id}`}
                    value={values.stock}
                    onChange={(e) => onEditChange(variant.id, { ...values, stock: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`price-${variant.id}`}>{t("priceOverride")}</Label>
                  <NumericInput
                    id={`price-${variant.id}`}
                    allowDecimal
                    placeholder={t("inherits", { value: formatMoney(variant.resolvedPrice, currency, locale) })}
                    value={values.priceOverride}
                    onChange={(e) => onEditChange(variant.id, { ...values, priceOverride: e.target.value })}
                  />
                </div>

                {canSeeCost && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`cost-${variant.id}`}>{t("cost")}</Label>
                    <NumericInput
                      id={`cost-${variant.id}`}
                      allowDecimal
                      placeholder={
                        variant.resolvedCost
                          ? t("inherits", { value: formatMoney(variant.resolvedCost, currency, locale) })
                          : undefined
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
            )}

            <button
              type="button"
              onClick={() => setExpandedImagesId(imagesOpen ? null : variant.id)}
              className="flex min-h-9 items-center justify-between gap-2 text-sm font-medium text-foreground"
              aria-expanded={imagesOpen}
            >
              <span>
                {tImages("variantSectionTitle")} · {variant.images.length}
              </span>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", imagesOpen && "rotate-180")} aria-hidden="true" />
            </button>

            {imagesOpen && (
              <ImageManager
                owner={{ variantId: variant.id }}
                initialImages={variant.images}
                canDelete={canDeleteImages}
                emptyHint={tImages("variantFallbackHint")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

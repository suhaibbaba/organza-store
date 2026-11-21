"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Trash2, TriangleAlert } from "lucide-react";
import { Button, Switch } from "@store/ui";
import type { Variant, VariantType } from "@organza/shared/types/variant";
import { fieldTestSelector, testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { NumericInput } from "@/components/fields/numeric-input";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { isNonNegativeDecimalString, parseQuantity } from "@/lib/validation/numeric";
import { variantBarcodeIncomplete } from "@/lib/validation/variant-edit";
import { ImageManager } from "@/components/products/image-manager";
import { BarcodeField } from "@/components/products/barcode-field";
import { cn } from "@/lib/utils";
import type { GallerySlot, VariantEditValues } from "@/types/productForm";

interface VariantEditListProps {
  variants: Variant[];
  variantTypes: VariantType[];
  currency: string;
  canSeeCost: boolean;
  canEditDetails: boolean;
  canEditPrice: boolean;
  canEditStock: boolean;
  canHide: boolean;
  canRemoveCombos: boolean;
  canDeleteImages: boolean;
  edits: Record<string, VariantEditValues>;
  onEditChange: (variantId: string, values: VariantEditValues) => void;
  imageSlots: Record<string, GallerySlot[]>;
  onImageSlotsChange: (variantId: string, slots: GallerySlot[]) => void;
  isSaving: boolean;
  removedIds: Set<string>;
  onRemove: (variantId: string) => void;
  onRestore: (variantId: string) => void;
}

export function VariantEditList({
  variants,
  variantTypes,
  currency,
  canSeeCost,
  canEditDetails,
  canEditPrice,
  canEditStock,
  canHide,
  canRemoveCombos,
  canDeleteImages,
  edits,
  onEditChange,
  imageSlots,
  onImageSlotsChange,
  isSaving,
  removedIds,
  onRemove,
  onRestore,
}: VariantEditListProps) {
  const t = useTranslations("products.form.variants");
  const tCommon = useTranslations("common");
  const tImages = useTranslations("products.form.images");
  const locale = useLocale();
  const [expandedImagesId, setExpandedImagesId] = useState<string | null>(null);
  // Only cards toggled by hand; everything else follows the rule below.
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});

  // Variants added later (from "add more combinations") open on arrival.
  const [knownIds] = useState(() => new Set(variants.map((variant) => variant.id)));

  // variantTypeId -> translated type name (e.g. "اللون", "المقاس", "الأرقام").
  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of variantTypes) map.set(type.id, localize(type.name, locale));
    return map;
  }, [variantTypes, locale]);

  // Tagged with its type (a reference, rule 2) so a colour isn't mistaken for a size.
  function labeledValues(variant: Variant): { key: string; typeName: string; value: string }[] {
    return variant.values.map((v) => ({
      key: v.id,
      typeName: typeNameById.get(v.variantTypeId) ?? "",
      value: localize(v.value, locale),
    }));
  }

  // `items-start` keeps an expanded card from stretching its neighbour.
  return (
    <div className="grid grid-cols-1 items-start gap-2 xl:grid-cols-2">
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
              className="flex items-center justify-between gap-3 rounded-panel border border-dashed border-line-strong p-3"
            >
              <div className="min-w-0">
                {groups.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {groups.map((g) => (
                      <span key={g.key} className="text-label font-medium text-ink-muted line-through">
                        <span className="text-ink-subtle">{g.typeName}:</span> {g.value}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-label font-medium text-ink-muted line-through">{name}</p>
                )}
                <p className="text-micro text-ink-muted">{variant.sku}</p>
              </div>
              <Button variant="secondary" onClick={() => onRestore(variant.id)}>
                {t("undo")}
              </Button>
            </div>
          );
        }

        // A half-typed supplier code blocks the form's Save, so that card opens itself unless closed by hand.
        const hasProblem = variantBarcodeIncomplete(values);
        const isNew = !knownIds.has(variant.id);
        const isOpen = openOverrides[variant.id] ?? (isNew || hasProblem);

        // The price actually charged: a valid override, else inherited (rule 3).
        const effectivePrice = isNonNegativeDecimalString(values.priceOverride)
          ? values.priceOverride
          : variant.resolvedPrice;
        const summary = [
          t("summaryStock", { count: parseQuantity(values.stock) }),
          formatMoney(effectivePrice, currency, locale),
        ];

        return (
          <div
            key={variant.id}
            className="rounded-panel border border-line bg-surface"
            data-test-selector={testSelectorFor("variant-edit-row", variant.id)}
          >
            <button
              type="button"
              onClick={() => setOpenOverrides((prev) => ({ ...prev, [variant.id]: !isOpen }))}
              aria-expanded={isOpen}
              aria-label={t("toggleDetails", { name })}
              className="flex w-full items-center gap-2 p-3 text-start transition-colors hover:bg-row-hover"
            >
              <ChevronDown
                className={cn("size-4 shrink-0 text-ink-muted transition-transform", isOpen && "rotate-180")}
                aria-hidden="true"
              />

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {groups.length > 0 ? (
                    groups.map((g) => (
                      <span
                        key={g.key}
                        className="inline-flex items-baseline gap-1 rounded-chip bg-inset px-1.5 py-0.5 text-label font-medium text-ink"
                      >
                        <span className="text-micro text-ink-muted">{g.typeName}:</span>
                        {g.value}
                      </span>
                    ))
                  ) : (
                    <span className="truncate text-label font-medium text-ink">{name}</span>
                  )}
                  <span className="truncate text-micro text-ink-muted" dir="ltr">
                    {variant.sku}
                  </span>
                </span>
                {!isOpen && (
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-micro">
                    <span className="tabular-nums text-ink-muted">{summary[0]}</span>
                    <span className="font-medium tabular-nums text-ink">{summary[1]}</span>
                    {!values.isActive && <span className="font-medium text-ink-muted">{t("hidden")}</span>}
                    {hasProblem && (
                      <span className="inline-flex items-center gap-1 font-medium text-danger-600">
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                        {t("barcodeIncomplete")}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </button>

            {isOpen && (
              <div className="flex flex-col divide-y divide-line border-t border-line">
                {canEditDetails && (
                  <>
                    {(canEditStock || canHide) && (
                      <div className="flex flex-col gap-2 px-3 py-2">
                        {canEditStock && (
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                            <span className="text-label font-medium text-ink">{t("stock")}</span>
                            <QuantityStepper
                              value={parseQuantity(values.stock)}
                              onChange={(stock) => onEditChange(variant.id, { ...values, stock: String(stock) })}
                              decreaseLabel={tCommon("quantity.decrease", { name })}
                              increaseLabel={tCommon("quantity.increase", { name })}
                              valueLabel={tCommon("quantity.value", { name })}
                            />
                          </div>
                        )}

                        {/* Its own row: in the pricing grid it read as belonging to the cost box. */}
                        {canHide && (
                          <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                            <label htmlFor={`active-${variant.id}`} className="text-label font-medium text-ink">
                              {t("active")}
                            </label>
                            <Switch
                              id={`active-${variant.id}`}
                              data-testid={fieldTestSelector(`active-${variant.id}`)}
                              label={t("active")}
                              hideLabel
                              checked={values.isActive}
                              onCheckedChange={(checked) => onEditChange(variant.id, { ...values, isActive: checked })}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Wrapping row with a floor per field: fixed columns cut the inherited-price placeholder off on phones. */}
                    <div className="flex flex-wrap gap-x-5 gap-y-3 px-3 py-3">
                      {canSeeCost && (
                        <div className="flex min-w-44 flex-1 flex-col gap-1.5">
                          <label htmlFor={`cost-${variant.id}`} className="text-label font-medium text-ink">
                            {t("cost")}
                          </label>
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

                      {canEditPrice ? (
                        <div className="flex min-w-44 flex-1 flex-col gap-1.5">
                          <label htmlFor={`price-${variant.id}`} className="text-label font-medium text-ink">
                            {t("priceOverride")}
                          </label>
                          <NumericInput
                            id={`price-${variant.id}`}
                            allowDecimal
                            placeholder={t("inherits", { value: formatMoney(variant.resolvedPrice, currency, locale) })}
                            value={values.priceOverride}
                            onChange={(e) => onEditChange(variant.id, { ...values, priceOverride: e.target.value })}
                          />
                        </div>
                      ) : (
                        // Read-only for a role that can't re-price; the number must still be visible.
                        <div className="flex min-w-44 flex-1 flex-col gap-1.5">
                          <span className="text-label font-medium text-ink">{t("priceOverride")}</span>
                          <p className="text-label font-semibold text-ink">
                            {formatMoney(variant.resolvedPrice, currency, locale)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Per-size code: one can carry the supplier's tag while the next uses ours. */}
                    <div className="px-3 py-2">
                      <BarcodeField
                        id={`barcode-${variant.id}`}
                        compact
                        source={values.barcodeSource}
                        value={values.barcode}
                        onChange={({ source, value }) =>
                          onEditChange(variant.id, { ...values, barcodeSource: source, barcode: value })
                        }
                        currentCode={variant.barcode}
                        disabled={isSaving}
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setExpandedImagesId(imagesOpen ? null : variant.id)}
                    className="flex min-h-11 items-center justify-between gap-2 text-label font-medium text-ink"
                    aria-expanded={imagesOpen}
                  >
                    <span>
                      {tImages("variantSectionTitle")} · {(imageSlots[variant.id] ?? []).length}
                    </span>
                    <ChevronDown
                      className={cn("size-4 text-ink-muted transition-transform", imagesOpen && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>

                  {imagesOpen && (
                    <ImageManager
                      slots={imageSlots[variant.id] ?? []}
                      onChange={(next) => onImageSlotsChange(variant.id, next)}
                      canDelete={canDeleteImages}
                      isBusy={isSaving}
                      emptyHint={tImages("variantFallbackHint")}
                    />
                  )}
                </div>

                {/* The one irreversible action sits last, only inside an opened card. */}
                {canEditDetails && canRemoveCombos && (
                  <div className="px-3 py-2">
                    <Button
                      variant="quiet"
                      onClick={() => onRemove(variant.id)}
                      className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                      icon={<Trash2 className="size-4" aria-hidden="true" />}
                    >
                      {t("removeCombo")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

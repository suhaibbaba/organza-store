"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, TriangleAlert } from "lucide-react";
import { Button, Checkbox } from "@store/ui";
import type { Variant, VariantType } from "@organza/shared/types/variant";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { isNonNegativeDecimalString, parseQuantity } from "@/lib/validation/numeric";
import { variantBarcodeIncomplete } from "@/lib/validation/variant-edit";
import { VariantEditDrawer } from "@/components/products/variant-edit-drawer";
import { VariantBulkBar } from "@/components/products/variant-bulk-bar";
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
  const locale = useLocale();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of variantTypes) map.set(type.id, localize(type.name, locale));
    return map;
  }, [variantTypes, locale]);

  function labeledValues(variant: Variant): { key: string; typeName: string; value: string }[] {
    return variant.values.map((v) => ({
      key: v.id,
      typeName: typeNameById.get(v.variantTypeId) ?? "",
      value: localize(v.value, locale),
    }));
  }

  const inlineStock = canEditDetails && canEditStock;
  const canRemoveSelected = canEditDetails && canRemoveCombos;
  const selectable = inlineStock || canRemoveSelected;
  const liveIds = variants.filter((v) => !removedIds.has(v.id) && edits[v.id]).map((v) => v.id);
  const checked = liveIds.filter((id) => checkedIds.has(id));

  function toggleChecked(id: string, on: boolean) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function applyStockToChecked(stock: number) {
    for (const id of checked) {
      const values = edits[id];
      if (values) onEditChange(id, { ...values, stock: String(stock) });
    }
  }

  function removeChecked() {
    for (const id of checked) onRemove(id);
    setCheckedIds(new Set());
  }

  const editing = variants.find((variant) => variant.id === editingId && !removedIds.has(variant.id));

  return (
    <>
      <div className="divide-y divide-line overflow-hidden rounded-control border border-line bg-surface">
      {selectable && liveIds.length > 1 && (
        <VariantBulkBar
          name="variant"
          total={liveIds.length}
          checked={checked.length}
          onCheckAll={(on) => setCheckedIds(new Set(on ? liveIds : []))}
          onSetStock={inlineStock ? applyStockToChecked : undefined}
          onRemove={canRemoveSelected ? removeChecked : undefined}
        />
      )}
      <ul data-test-selector="variant-edit-list" className="divide-y divide-line">
      {variants.map((variant) => {
        const name = localize(variant.name, locale);
        const groups = labeledValues(variant);
        const values = edits[variant.id];
        const isRemoved = removedIds.has(variant.id);

        if (!values) return null;

        const chips = (
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {groups.length > 0 ? (
              groups.map((g) => (
                <span
                  key={g.key}
                  className={cn(
                    "inline-flex items-baseline gap-1 rounded-chip bg-inset px-2 py-0.5 text-label text-ink",
                    isRemoved && "text-ink-muted line-through"
                  )}
                >
                  <span className="text-micro text-ink-muted">{g.typeName}</span>
                  {g.value}
                </span>
              ))
            ) : (
              <span className={cn("truncate text-label text-ink", isRemoved && "line-through")}>{name}</span>
            )}
          </span>
        );
        const sku = (
          <span className="text-micro text-ink-muted tabular-nums" dir="ltr">
            {variant.sku}
          </span>
        );

        if (isRemoved) {
          return (
            <li key={variant.id} className="flex min-h-14 items-center gap-3 bg-inset px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {chips}
                {sku}
              </span>
              <Button variant="secondary" onClick={() => onRestore(variant.id)}>
                {t("undo")}
              </Button>
            </li>
          );
        }

        const hasProblem = variantBarcodeIncomplete(values);
        const open = () => setEditingId(variant.id);
        const effectivePrice = isNonNegativeDecimalString(values.priceOverride)
          ? values.priceOverride
          : variant.resolvedPrice;
        return (
          <li key={variant.id} data-test-selector={testSelectorFor("variant-edit-row", variant.id)}>
            <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 transition-colors hover:bg-row-hover">
              {selectable && liveIds.length > 1 && (
                <Checkbox
                  size="sm"
                  hideLabel
                  data-testid={testSelectorFor("variant-select", variant.id)}
                  label={t("selectRow", { name })}
                  checked={checkedIds.has(variant.id)}
                  onCheckedChange={(on) => toggleChecked(variant.id, on)}
                />
              )}
              <button
                type="button"
                onClick={open}
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 text-start sm:basis-0"
              >
                {chips}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {sku}
                  {!values.isActive && <span className="text-micro text-ink-muted">· {t("hidden")}</span>}
                  {hasProblem && (
                    <span className="inline-flex items-center gap-1 text-micro text-danger-600">
                      <TriangleAlert className="size-3.5" aria-hidden="true" />
                      {t("barcodeIncomplete")}
                    </span>
                  )}
                </span>
              </button>

              <span className="flex w-full items-center gap-3 sm:w-auto">
              {inlineStock ? (
                <QuantityStepper
                  name={`variant-${variant.id}`}
                  value={parseQuantity(values.stock)}
                  onChange={(stock) => onEditChange(variant.id, { ...values, stock: String(stock) })}
                  decreaseLabel={tCommon("quantity.decrease", { name })}
                  increaseLabel={tCommon("quantity.increase", { name })}
                  valueLabel={tCommon("quantity.value", { name })}
                />
              ) : (
                <span className="text-label text-ink-muted tabular-nums">
                  {t("summaryStock", { count: parseQuantity(values.stock) })}
                </span>
              )}

              <span className="ms-auto w-24 shrink-0 text-end text-value text-ink tabular-nums" dir="ltr">
                {formatMoney(effectivePrice, currency, locale)}
              </span>

              <button
                type="button"
                onClick={open}
                aria-label={t("toggleDetails", { name })}
                data-test-selector={testSelectorFor("variant-edit-open", variant.id)}
                className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-muted hover:bg-inset hover:text-ink"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              </span>
            </div>

          </li>
        );
      })}
      </ul>
      </div>
      <VariantEditDrawer
        variant={editing ?? null}
        title={editing ? `${localize(editing.name, locale)} · ${editing.sku}` : ""}
        values={editing ? edits[editing.id] : undefined}
        currency={currency}
        canSeeCost={canSeeCost}
        canEditDetails={canEditDetails}
        canEditPrice={canEditPrice}
        canHide={canHide}
        canRemove={canRemoveCombos}
        canDeleteImages={canDeleteImages}
        imageSlots={editing ? (imageSlots[editing.id] ?? []) : []}
        isSaving={isSaving}
        onEditChange={(next) => editing && onEditChange(editing.id, next)}
        onImageSlotsChange={(next) => editing && onImageSlotsChange(editing.id, next)}
        onRemove={() => editing && onRemove(editing.id)}
        onClose={() => setEditingId(null)}
      />
    </>
  );
}

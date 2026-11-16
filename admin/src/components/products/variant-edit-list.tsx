"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Trash2, TriangleAlert } from "lucide-react";
import type { Variant, VariantType } from "@organza/shared/types/variant";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { NumericInput } from "@/components/ui/numeric-input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { isNonNegativeDecimalString, parseQuantity } from "@/lib/validation/numeric";
import { variantBarcodeIncomplete } from "@/lib/validation/variant-edit";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/products/image-manager";
import { BarcodeField } from "@/components/products/barcode-field";
import { cn } from "@/lib/utils";
import type { GallerySlot, VariantEditValues } from "@/types/productForm";

interface VariantEditListProps {
  variants: Variant[];
  // Needed to label each option value with the variant type it came from
  // (e.g. "اللون: أحمر"), so a value reads unambiguously as a colour, size or
  // number rather than a bare word.
  variantTypes: VariantType[];
  currency: string;
  canSeeCost: boolean;
  canEditDetails: boolean;
  canEditPrice: boolean;
  canEditStock: boolean;
  canHide: boolean;
  // Deleting a combination is product.delete, not product.edit — an Employee
  // edits the row but never removes it, so the button isn't there at all
  // rather than failing on save.
  canRemoveCombos: boolean;
  canDeleteImages: boolean;
  edits: Record<string, VariantEditValues>;
  onEditChange: (variantId: string, values: VariantEditValues) => void;
  // Each variant's working gallery, keyed by variant id, and busy while the
  // form is saving — these are staged like every other edit here and written
  // by the form's one Save.
  imageSlots: Record<string, GallerySlot[]>;
  onImageSlotsChange: (variantId: string, slots: GallerySlot[]) => void;
  isSaving: boolean;
  removedIds: Set<string>;
  onRemove: (variantId: string) => void;
  onRestore: (variantId: string) => void;
}

// Edit-mode only: existing variant rows, each editable in place. Name comes
// from the referenced option values (CLAUDE.md rule 2) and stays read-only
// here — rename the global value instead. Removing a row is staged locally
// (undo-able) and only sent as DELETE on final submit — as are the photos:
// picking, removing and reordering them here stages the change, and the
// product form's single Save writes the lot.
//
// Every variant is a small form, and a product can have thirty of them. Open,
// they turned this screen into a scroll nobody could find anything in — so
// each one is folded down to a line that answers the question actually being
// asked of a list ("which one is this, and how many are there?") and opens
// only when it is the one being edited.
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
  // Only the cards the user has opened or closed by hand. Everything else
  // falls back to the rule below, so nothing has to be kept in sync.
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});

  // The variants this product already had when the screen was opened. Anything
  // that turns up later arrived from "add more combinations" — it is what the
  // user just asked for, and it opens on arrival rather than as another closed
  // line they have to go and find. Held as lazily-initialised state rather
  // than a ref because it is read while rendering.
  const [knownIds] = useState(() => new Set(variants.map((variant) => variant.id)));

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

  // Two editors across on a wide screen — each one is a small form, so it
  // takes more room than a display row and gets fewer columns than the read-
  // only list does. `items-start` keeps a card whose photos are expanded from
  // stretching its neighbour to match.
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

        // A supplier code that is half-typed blocks the whole form's Save
        // (see product-form.tsx). Folding that card away would leave the user
        // staring at an error with nothing on screen to fix, so a card with a
        // problem opens itself and says so on its own line — unless the user
        // has deliberately closed it, which their own choice still wins.
        const hasProblem = variantBarcodeIncomplete(values);
        const isNew = !knownIds.has(variant.id);
        const isOpen = openOverrides[variant.id] ?? (isNew || hasProblem);

        // What the fold has to answer without being opened: which one is this,
        // how many are there, and what does it sell for. The price is the one
        // that will actually be charged — the override if a valid one has been
        // typed, the inherited price otherwise (CLAUDE.md rule 3).
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
            className="rounded-xl border border-border bg-card"
            data-test-selector={testSelectorFor("variant-edit-row", variant.id)}
          >
            {/* The whole line is the tap target — on a phone a chevron alone
                is a poor one, and this list is worked through card by card. */}
            <button
              type="button"
              onClick={() => setOpenOverrides((prev) => ({ ...prev, [variant.id]: !isOpen }))}
              aria-expanded={isOpen}
              aria-label={t("toggleDetails", { name })}
              className="flex w-full items-center gap-2 p-3 text-start transition-colors not-disabled:hover:bg-accent/40"
            >
              <ChevronDown
                className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                aria-hidden="true"
              />

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {groups.length > 0 ? (
                    groups.map((g) => (
                      <span
                        key={g.key}
                        className="inline-flex items-baseline gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-sm font-medium text-secondary-foreground"
                      >
                        <span className="text-xs text-muted-foreground">{g.typeName}:</span>
                        {g.value}
                      </span>
                    ))
                  ) : (
                    <span className="truncate text-sm font-medium text-foreground">{name}</span>
                  )}
                  <span className="truncate text-xs text-muted-foreground" dir="ltr">
                    {variant.sku}
                  </span>
                </span>

                {/* Closed, this is the whole card. Open, it would only repeat
                    the fields below it. */}
                {!isOpen && (
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                    <span className="tabular-nums text-muted-foreground">{summary[0]}</span>
                    <span className="font-medium tabular-nums text-foreground">{summary[1]}</span>
                    {!values.isActive && <span className="font-medium text-muted-foreground">{t("hidden")}</span>}
                    {hasProblem && (
                      <span className="inline-flex items-center gap-1 font-medium text-destructive">
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                        {t("barcodeIncomplete")}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </button>

            {isOpen && (
              // Read top to bottom: stock, then what it costs and sells for,
              // then its code, then its photos — with hairlines rather than
              // large gaps doing the separating, which is what lets three of
              // these fit where one used to.
              <div className="flex flex-col divide-y divide-border border-t border-border">
                {canEditDetails && (
                  <>
                    {(canEditStock || canHide) && (
                      <div className="flex flex-col gap-2 px-3 py-2">
                        {canEditStock && (
                          // Label and stepper on one line: a stepper is a
                          // fixed 150-odd pixels and can never fill a row, so
                          // giving it one leaves exactly the dead space this
                          // card had too much of.
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                            <span className="text-sm font-medium">{t("stock")}</span>
                            <QuantityStepper
                              value={parseQuantity(values.stock)}
                              onChange={(stock) => onEditChange(variant.id, { ...values, stock: String(stock) })}
                              decreaseLabel={tCommon("quantity.decrease", { name })}
                              increaseLabel={tCommon("quantity.increase", { name })}
                              valueLabel={tCommon("quantity.value", { name })}
                            />
                          </div>
                        )}

                        {/* Its own row, next to its own label: sat in the
                            pricing grid it read as a switch belonging to the
                            cost box beside it. */}
                        {canHide && (
                          <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                            <Label htmlFor={`active-${variant.id}`}>{t("active")}</Label>
                            <Switch
                              id={`active-${variant.id}`}
                              checked={values.isActive}
                              onCheckedChange={(checked) => onEditChange(variant.id, { ...values, isActive: checked })}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cost and price are the same kind of number about the
                        same piece, so they share a row WHERE THERE IS ROOM
                        for one. Two fixed columns meant ~150px each on a
                        phone — narrower than the box's own placeholder, so
                        "موروث: ٧٠٫٠٠ ₪" was cut off mid-figure, which is
                        exactly the figure the placeholder exists to show.
                        A wrapping row with a floor under each field is what
                        fixes it at every width rather than at one breakpoint:
                        this card is half a column wide on a desktop and the
                        whole screen on a phone, and a viewport breakpoint
                        cannot tell those apart. */}
                    <div className="flex flex-wrap gap-x-5 gap-y-3 px-3 py-3">
                      {canSeeCost && (
                        <div className="flex min-w-44 flex-1 flex-col gap-1.5">
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

                      {canEditPrice ? (
                        <div className="flex min-w-44 flex-1 flex-col gap-1.5">
                          <Label htmlFor={`price-${variant.id}`}>{t("priceOverride")}</Label>
                          <NumericInput
                            id={`price-${variant.id}`}
                            allowDecimal
                            placeholder={t("inherits", { value: formatMoney(variant.resolvedPrice, currency, locale) })}
                            value={values.priceOverride}
                            onChange={(e) => onEditChange(variant.id, { ...values, priceOverride: e.target.value })}
                          />
                        </div>
                      ) : (
                        // Read-only for a role that can fix the piece but not
                        // re-price it — the number still has to be visible.
                        <div className="flex min-w-44 flex-1 flex-col gap-1.5">
                          <Label>{t("priceOverride")}</Label>
                          <p className="text-sm font-semibold text-foreground">
                            {formatMoney(variant.resolvedPrice, currency, locale)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Each size's own code: one can carry the supplier's
                        printed tag while the next still uses ours. */}
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
                    className="flex min-h-11 items-center justify-between gap-2 text-sm font-medium text-foreground"
                    aria-expanded={imagesOpen}
                  >
                    <span>
                      {tImages("variantSectionTitle")} · {(imageSlots[variant.id] ?? []).length}
                    </span>
                    <ChevronDown
                      className={cn("size-4 text-muted-foreground transition-transform", imagesOpen && "rotate-180")}
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

                {/* Last, behind its own rule, and only inside an opened card:
                    the one irreversible thing here should not be a small
                    target sitting beside the line you tap to read a variant. */}
                {canEditDetails && canRemoveCombos && (
                  <div className="px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(variant.id)}
                      className="text-destructive not-disabled:hover:bg-destructive/10 not-disabled:hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
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

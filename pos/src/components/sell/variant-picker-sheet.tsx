"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Alert, Button } from "@store/ui";
import type { Product } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { hasPlacedNumbers, isNumberedProduct, variantsByNumber } from "@/lib/numbered";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { NumericInput } from "@/components/fields/numeric-input";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { StockBadge } from "@/components/sell/stock-badge";
import { VariantNotes } from "@/components/sell/variant-notes";
import { ProductThumb } from "@/components/sell/product-thumb";
import { NumberedPhoto } from "@/components/sell/numbered-photo";
import { CONTROL_HEIGHT } from "@/components/sell/screen/control-styles";
import { VARIANT_PICKER_PHOTO_SIZES, VARIANT_TILE_THUMB_SIZES } from "@/constants/images";
import { primaryImage } from "@/lib/primary-image";
import { cn } from "@/lib/utils";

interface VariantPickerSheetProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  // In the order chosen; the cart takes them in one go so the sale is reported once.
  onPick: (product: Product, variants: Variant[]) => void;
}

// A variant-bearing parent owns neither price nor stock, so a search result or parent barcode landing on one asks which variant.
export function VariantPickerSheet({ product, onOpenChange, onPick }: VariantPickerSheetProps) {
  const t = useTranslations("sell.picker");
  const locale = useLocale();

  const isNumbered = product ? isNumberedProduct(product) : false;
  // A numbered shawl's photo is shown large with its numbers in the body instead.
  const showsNumberedPhoto = product ? hasPlacedNumbers(product) : false;

  return (
    // Capped and centred on a wide screen so a row of tiles is not marooned across the whole display.
    <BottomSheet
      open={product !== null}
      onOpenChange={onOpenChange}
      name="variant-picker"
      className="mx-auto max-w-4xl"
      headerClassName="items-center"
      title={product ? <span className="block truncate">{localize(product.name, locale)}</span> : ""}
      description={isNumbered ? t("numberedSubtitle") : t("subtitle")}
      headerLeading={
        product && !showsNumberedPhoto ? (
          <ProductThumb
            src={primaryImage(product.images)?.thumbnailUrl}
            alt={localize(product.name, locale)}
            sizes={VARIANT_PICKER_PHOTO_SIZES}
            className="size-16 rounded-photo bg-sunken"
          />
        ) : undefined
      }
    >
      {/* Keyed by product so a different collection starts clean. */}
      {product && (
        <VariantPicker
          key={product.id}
          product={product}
          isNumbered={isNumbered}
          onPick={onPick}
          onClose={() => onOpenChange(false)}
        />
      )}
    </BottomSheet>
  );
}

interface VariantPickerProps {
  product: Product;
  isNumbered: boolean;
  onPick: (product: Product, variants: Variant[]) => void;
  onClose: () => void;
}

// Choosing and adding are separate steps so a mis-tap is undone by a second tap; numbered shawls can be typed and the sheet stays open for the next number.
function VariantPicker({ product, isNumbered, onPick, onClose }: VariantPickerProps) {
  const t = useTranslations("sell.picker");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  // An array, not a Set: tap order is the order the lines land in the cart.
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [numberQuery, setNumberQuery] = useState("");
  const [notFound, setNotFound] = useState(false);

  const visibleVariants = useMemo(() => {
    if (!isNumbered || !numberQuery.trim()) return product.variants;
    const matches = variantsByNumber(product, numberQuery);
    return matches.length > 0 ? matches : product.variants;
  }, [product, isNumbered, numberQuery]);

  // Exactly one sellable variant for the typed number, or nothing.
  const typedMatch = useMemo(() => {
    if (!isNumbered || !numberQuery.trim()) return null;
    const matches = variantsByNumber(product, numberQuery).filter((variant) => variant.stock > 0);
    return matches.length === 1 ? matches[0] : null;
  }, [product, isNumbered, numberQuery]);

  // A number still in the box counts as chosen: typing 4 then reaching for Add means the 4.
  const chosen = useMemo(() => {
    const ids = [...selectedIds];
    if (typedMatch && !ids.includes(typedMatch.id)) ids.push(typedMatch.id);
    return ids
      .map((id) => product.variants.find((variant) => variant.id === id))
      .filter((variant): variant is Variant => variant !== undefined && variant.stock > 0);
  }, [product, selectedIds, typedMatch]);

  const chosenIds = useMemo(() => new Set(chosen.map((variant) => variant.id)), [chosen]);

  function toggle(variant: Variant) {
    if (variant.stock <= 0) return;
    setNotFound(false);

    // Chosen only because the box holds it, so un-choosing clears the box.
    if (typedMatch?.id === variant.id && !selectedIds.includes(variant.id)) {
      setNumberQuery("");
      return;
    }

    setSelectedIds((previous) =>
      previous.includes(variant.id)
        ? previous.filter((id) => id !== variant.id)
        : [...previous, variant.id]
    );
  }

  // Done/Enter adds the typed number to the selection, not to the cart.
  function handleNumberSubmit(event: FormEvent) {
    event.preventDefault();
    if (!typedMatch) {
      setNotFound(true);
      return;
    }
    setSelectedIds((previous) =>
      previous.includes(typedMatch.id) ? previous : [...previous, typedMatch.id]
    );
    setNumberQuery("");
    setNotFound(false);
  }

  function addChosen() {
    if (chosen.length === 0) return;
    onPick(product, chosen);
    setSelectedIds([]);
    setNumberQuery("");
    setNotFound(false);

    // The toast reports what landed; nothing is refocused on purpose.
    if (!isNumbered) onClose();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        {isNumbered && <NumberedPhoto product={product} chosenIds={chosenIds} onToggle={toggle} />}

        {isNumbered && (
          <form onSubmit={handleNumberSubmit} className="flex flex-col gap-2">
            <label htmlFor="pos-number-entry" className="text-label text-ink">
              {t("numberLabel")}
            </label>
            <NumericInput
              id="pos-number-entry"
              data-test-selector="pos-number-entry"
              value={numberQuery}
              onChange={(event) => {
                setNumberQuery(event.target.value);
                setNotFound(false);
              }}
              placeholder={t("numberPlaceholder")}
              enterKeyHint="done"
              className="h-12 text-lg"
            />
          </form>
        )}

        {notFound && <Alert tone="danger" data-testid="alert-destructive">{t("numberNotFound")}</Alert>}

        <ul
          data-test-selector="pos-variant-picker"
          className={cn(
            "grid gap-2",
            isNumbered
              ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {visibleVariants.map((variant) => {
            const soldOut = variant.stock <= 0;
            const isChosen = chosenIds.has(variant.id);
            const name = localize(variant.name, locale);
            const photo = primaryImage(variant.images);

            return (
              <li key={variant.id}>
                <button
                  type="button"
                  disabled={soldOut}
                  aria-pressed={isChosen}
                  onClick={() => toggle(variant)}
                  data-test-selector={testSelectorFor("pos-variant-option", variant.id)}
                  className={cn(
                    "relative flex w-full cursor-pointer flex-col items-start justify-center gap-1 rounded-panel border p-3 text-start transition-colors",
                    "min-h-16 focus-darken",
                    "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-inset/40 disabled:opacity-70",
                    isNumbered && "items-center text-center",
                    // A chosen tile must be unmistakable at arm's length: fill, border, weight and a tick together.
                    isChosen
                      ? "border-selected-line bg-selected font-semibold text-ink ring-2 ring-primary-600"
                      : "border-line bg-surface not-disabled:hover:bg-row-hover"
                  )}
                >
                  {isChosen && (
                    <span
                      className="absolute end-2 top-2 flex size-5 items-center justify-center rounded-pill bg-primary-600 text-ink-inverse"
                      aria-hidden="true"
                    >
                      <Check className="size-3.5" />
                    </span>
                  )}

                  {photo && (
                    <ProductThumb
                      src={photo.thumbnailUrl}
                      alt={name}
                      sizes={VARIANT_TILE_THUMB_SIZES}
                      className={cn("size-14 rounded-photo bg-sunken", soldOut && "opacity-60")}
                    />
                  )}
                  <span
                    className={cn(
                      "font-medium",
                      isNumbered ? "text-xl text-ink" : "text-base text-ink",
                      soldOut && "line-through decoration-1"
                    )}
                  >
                    {name}
                  </span>
                  <VariantNotes variant={variant} className={cn(isNumbered && "text-center")} />
                  {/* The price stays on a sold-out tile: the cashier is often asked the price of a piece that just sold. */}
                  <span className="text-label text-ink-muted">{formatMoney(variant.resolvedPrice)}</span>
                  <StockBadge
                    stock={variant.stock}
                    trackLowStock={product.trackLowStock}
                    showCount={!isNumbered}
                    size={isNumbered ? "sm" : "md"}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-line bg-surface px-5 pb-5 pt-3">
        <p aria-live="polite" className="min-h-5 text-label font-medium text-ink-muted">
          {chosen.length > 0 ? t("selectedCount", { count: chosen.length }) : ""}
        </p>

        <div className="flex items-stretch gap-3 tab:justify-end">
          <Button
            type="button"
            onClick={addChosen}
            disabled={chosen.length === 0}
            data-testid="pos-variant-picker-add"
            className={cn(CONTROL_HEIGHT, "hit-area min-h-0 min-w-0 flex-1 rounded-control py-0 text-sm tab:min-w-48 tab:flex-none")}
          >
            {chosen.length === 0 && t("add")}
            {chosen.length === 1 && t("addNamed", { name: localize(chosen[0].name, locale) })}
            {chosen.length > 1 && t("addCount", { count: chosen.length })}
          </Button>

          {isNumbered && (
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className={cn(CONTROL_HEIGHT, "hit-area min-h-0 min-w-28 shrink-0 rounded-control py-0 text-sm")}
            >
              {t("done")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

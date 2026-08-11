"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import type { Product } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { isNumberedProduct, variantsByNumber } from "@/lib/numbered";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StockBadge } from "@/components/ui/stock-badge";
import { cn } from "@/lib/utils";

interface VariantPickerSheetProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  // Everything the cashier chose, in the order they chose it — one variant or
  // ten. The cart takes them in one go so the sale is reported once.
  onPick: (product: Product, variants: Variant[]) => void;
}

// Which variants are being sold. A variant-bearing product's parent is not
// purchasable — it owns neither the price nor the stock — so this is asked
// whenever a search result or a parent barcode lands on one.
export function VariantPickerSheet({ product, onOpenChange, onPick }: VariantPickerSheetProps) {
  const t = useTranslations("sell.picker");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const isNumbered = product ? isNumberedProduct(product) : false;

  return (
    <Sheet open={product !== null} onOpenChange={onOpenChange}>
      {/* Capped and centred on a wide screen. A bottom sheet is pinned to
          both edges, so on the counter's laptop — or the touch monitor this
          is heading for — it used to run the full width of the display, with
          a row of size tiles marooned at one end and the cashier's eye
          travelling a foot to read it. On a phone the cap is above the
          viewport width, so nothing there changes at all. */}
      <SheetContent closeLabel={tCommon("close")} className="mx-auto max-w-4xl">
        {product && (
          <>
            <SheetHeader>
              <SheetTitle>{localize(product.name, locale)}</SheetTitle>
              <SheetDescription>{isNumbered ? t("numberedSubtitle") : t("subtitle")}</SheetDescription>
            </SheetHeader>

            {/* Keyed by product: opening a different collection starts from
                a clean number box and nothing selected, never the previous
                one's leftovers. */}
            <VariantPicker
              key={product.id}
              product={product}
              isNumbered={isNumbered}
              onPick={onPick}
              onClose={() => onOpenChange(false)}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface VariantPickerProps {
  product: Product;
  isNumbered: boolean;
  onPick: (product: Product, variants: Variant[]) => void;
  onClose: () => void;
}

// Picking is two separate steps, and deliberately so: tapping a variant only
// says which ones, and nothing reaches the cart until the Add button at the
// bottom is pressed.
//
// A tap that added immediately meant a mis-tap was already a wrong sale —
// undoing it needed the sheet closed and the line found and deleted, with a
// customer waiting. Now a mis-tap costs a second tap on the same tile to
// un-choose it, and what is about to be added is readable on screen, and
// counted, before it happens.
//
// Several at once because that is how these clothes sell: a customer takes the
// same dress in M and L, or three shawls off one photo. One trip through this
// sheet, one Add, one line in the cart per variant (quantity 1, adjustable
// there afterwards) — not a scan-search-tap-repeat cycle per piece.
//
// Numbered shawls (spec.md) keep their fast lane: the customer says "number 4"
// over WhatsApp or points at the photo, so typing 4 picks that shawl out and
// the keypad's Done adds it to the selection and clears the box for the next
// number. The sheet stays open after adding, because numbers from one
// collection are typically sold several at a time.
function VariantPicker({ product, isNumbered, onPick, onClose }: VariantPickerProps) {
  const t = useTranslations("sell.picker");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  // An array, not a Set: the order the cashier tapped in is the order the
  // lines land in the cart, which is the order they will read them back in.
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [numberQuery, setNumberQuery] = useState("");
  const [notFound, setNotFound] = useState(false);

  // Typing a number narrows the list to it, so the grid always agrees with
  // what's in the box — and the cashier can tap the match instead, whichever
  // is quicker for them. A number that matches nothing leaves the full list
  // up rather than emptying the sheet.
  const visibleVariants = useMemo(() => {
    if (!isNumbered || !numberQuery.trim()) return product.variants;
    const matches = variantsByNumber(product, numberQuery);
    return matches.length > 0 ? matches : product.variants;
  }, [product, isNumbered, numberQuery]);

  // The one sellable variant the number box is pointing at, if it points at
  // exactly one. Anything else — no such number, sold out, or a number shared
  // by several variants — is not a choice, and the narrowed grid is there to
  // make it one.
  const typedMatch = useMemo(() => {
    if (!isNumbered || !numberQuery.trim()) return null;
    const matches = variantsByNumber(product, numberQuery).filter((variant) => variant.stock > 0);
    return matches.length === 1 ? matches[0] : null;
  }, [product, isNumbered, numberQuery]);

  // What Add would take right now: what has been chosen, plus whatever is
  // still sitting in the number box. A cashier who types 4 and then reaches
  // straight for Add means the 4, and the tile shows as chosen to say so.
  const chosen = useMemo(() => {
    const ids = [...selectedIds];
    if (typedMatch && !ids.includes(typedMatch.id)) ids.push(typedMatch.id);
    return ids
      .map((id) => product.variants.find((variant) => variant.id === id))
      .filter((variant): variant is Variant => variant !== undefined && variant.stock > 0);
  }, [product, selectedIds, typedMatch]);

  const chosenIds = useMemo(() => new Set(chosen.map((variant) => variant.id)), [chosen]);

  function toggle(variant: Variant) {
    // Sold out is not selectable at all — the tile is disabled, this is the
    // belt to that braces.
    if (variant.stock <= 0) return;
    setNotFound(false);

    // It is only shown as chosen because it is what the number box holds, so
    // un-choosing it means clearing the box rather than editing the list.
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

  // "Done" on the phone's number pad, or Enter from a keyboard: the cashier
  // has typed a number and asked for it, so it joins the selection and the box
  // empties, ready for the next number. Still nothing in the cart — that is
  // the Add button's job, and it is one tap away with all of them on it.
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

    // What landed in the cart is said by the one toast over this sheet, so
    // there is nothing to report in here.
    //
    // Nothing is focused afterwards on purpose: the number box keeps the
    // keyboard it already had if the cashier was typing, and stays quiet if
    // they were tapping the grid.
    if (!isNumbered) onClose();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        {isNumbered && (
          <form onSubmit={handleNumberSubmit} className="flex flex-col gap-2">
            <label htmlFor="pos-number-entry" className="text-sm font-medium">
              {t("numberLabel")}
            </label>
            <NumericInput
              id="pos-number-entry"
              value={numberQuery}
              onChange={(event) => {
                setNumberQuery(event.target.value);
                setNotFound(false);
              }}
              placeholder={t("numberPlaceholder")}
              enterKeyHint="done"
              className="text-lg"
            />
          </form>
        )}

        {notFound && <Alert variant="destructive">{t("numberNotFound")}</Alert>}

        {/* One tile per row on a phone for sizes and colours — the names are
            words ("أخضر زيتي · مقاس L") and a phone has room for one of them
            across — and more per row as the screen grows, so a product with a
            dozen combinations is read at a glance on the counter's screen
            instead of scrolled through. Numbers keep their phone layout
            exactly: a number tile is a number, three fit across a phone and
            always have, and they simply get more columns where there is room.
            Every tile keeps its min-h-16 floor either way. */}
        <ul
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

            return (
              <li key={variant.id}>
                <button
                  type="button"
                  disabled={soldOut}
                  aria-pressed={isChosen}
                  onClick={() => toggle(variant)}
                  className={cn(
                    "relative flex w-full flex-col items-start justify-center gap-1 rounded-xl border p-3 text-start transition-colors",
                    "min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    // Sold out reads as unavailable before it is tapped: no
                    // card fill, a dashed edge, and the words in place of the
                    // price. Faded alone looked like a loading state.
                    "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted/40 disabled:opacity-70",
                    isNumbered && "items-center text-center",
                    // Every chosen one has to be unmistakable across a counter
                    // at arm's length — and with several chosen at once, at a
                    // glance — so it changes fill, border and weight together
                    // and carries a tick, not a faint tint that disappears
                    // under a shop's lighting.
                    isChosen
                      ? "border-primary bg-primary/15 font-semibold text-foreground ring-2 ring-primary"
                      : "border-border bg-card not-disabled:hover:bg-accent/60"
                  )}
                >
                  {isChosen && (
                    <span
                      className="absolute end-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      aria-hidden="true"
                    >
                      <Check className="size-3.5" />
                    </span>
                  )}

                  <span
                    className={cn(
                      "font-medium",
                      isNumbered ? "text-xl" : "text-base",
                      soldOut && "line-through decoration-1"
                    )}
                  >
                    {name}
                  </span>
                  {/* The price stays on a sold-out tile now that the badge
                      below says it is gone: the cashier is often being asked
                      "how much is that one?" about a piece that has just sold,
                      and the tile used to answer by hiding the figure.

                      The count is only spelled out where there is room for it.
                      A numbered tile is a third of a phone's width and shows
                      the status alone — how many of shawl number 4 are left is
                      almost always one, and the cart's own line says so when
                      it matters. */}
                  <span className="text-sm text-muted-foreground">{formatMoney(variant.resolvedPrice)}</span>
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

      {/* Pinned under the list: with a long grid the Add button must not be
          something you have to scroll to find, and it belongs where the
          thumb already is. */}
      <div className="flex flex-col gap-2 border-t border-border bg-background px-5 pb-5 pt-3">
        {/* How many are about to be added, said in words as well as in ticks —
            with a grid of numbers the ticks are easy to miscount, and this is
            also what a screen reader announces as the selection changes. */}
        <p aria-live="polite" className="min-h-5 text-sm font-medium text-muted-foreground">
          {chosen.length > 0 ? t("selectedCount", { count: chosen.length }) : ""}
        </p>

        {/* Two real buttons, not one button and an afterthought.
            "Done" is a short word — تم is two letters — and left to size
            itself it came out a third of Add's height in visual weight and
            barely wider than a thumb, which is a poor target for the one
            control that closes the sheet.

            So it is given a floor of its own (7rem, growing to 9rem where
            there is room) and the same h-12 as Add, and the hierarchy is
            carried by fill instead of by size: Add is the solid brand button
            and takes the remaining width, Done is outlined. Both stay well
            over the 44px minimum. */}
        <div className="flex items-stretch gap-3">
          <Button
            type="button"
            onClick={addChosen}
            disabled={chosen.length === 0}
            className="min-w-0 flex-1"
          >
            {/* One chosen variant is named outright — it is the common case
                and the name is the confirmation. Several are counted, because
                eight names do not fit on a phone's button. */}
            {chosen.length === 0 && t("add")}
            {chosen.length === 1 && t("addNamed", { name: localize(chosen[0].name, locale) })}
            {chosen.length > 1 && t("addCount", { count: chosen.length })}
          </Button>

          {isNumbered && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-w-28 shrink-0 sm:min-w-36"
            >
              {t("done")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

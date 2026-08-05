"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import type { Product } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { isNumberedProduct, variantsByNumber } from "@/lib/numbered";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  focusPanelNotFirstField,
} from "@/components/ui/sheet";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface VariantPickerSheetProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onPick: (product: Product, variant: Variant) => void;
}

// Which variant is being sold. A variant-bearing product's parent is not
// purchasable — it owns neither the price nor the stock — so this is asked
// whenever a search result or a parent barcode lands on one.
export function VariantPickerSheet({ product, onOpenChange, onPick }: VariantPickerSheetProps) {
  const t = useTranslations("sell.picker");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const isNumbered = product ? isNumberedProduct(product) : false;

  return (
    <Sheet open={product !== null} onOpenChange={onOpenChange}>
      {/* The numbered variant of this sheet leads with a number box; without
          this the phone keyboard would cover the very grid the cashier came
          here to look at. */}
      <SheetContent closeLabel={tCommon("close")} onOpenAutoFocus={focusPanelNotFirstField}>
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
  onPick: (product: Product, variant: Variant) => void;
  onClose: () => void;
}

// Picking is two separate steps, and deliberately so: tapping a variant only
// says which one, and nothing reaches the cart until the Add button at the
// bottom is pressed.
//
// A tap that added immediately meant a mis-tap was already a wrong sale —
// undoing it needed the sheet closed and the line found and deleted, with a
// customer waiting. Now a mis-tap costs a second tap on the right one, and
// what is about to be added is readable on screen before it happens.
//
// Numbered shawls (spec.md) keep their fast lane: the customer says "number
// 4" over WhatsApp or points at the photo, so typing 4 picks that shawl out
// and Add rings it up. The sheet stays open afterwards, because numbers
// from one collection are typically sold several at a time.
function VariantPicker({ product, isNumbered, onPick, onClose }: VariantPickerProps) {
  const t = useTranslations("sell.picker");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [numberQuery, setNumberQuery] = useState("");
  const [notFound, setNotFound] = useState(false);

  const selected = product.variants.find((variant) => variant.id === selectedId) ?? null;

  // Typing a number narrows the list to it, so the grid always agrees with
  // what's in the box — and the cashier can tap the match instead, whichever
  // is quicker for them. A number that matches nothing leaves the full list
  // up rather than emptying the sheet.
  const visibleVariants = useMemo(() => {
    if (!isNumbered || !numberQuery.trim()) return product.variants;
    const matches = variantsByNumber(product, numberQuery);
    return matches.length > 0 ? matches : product.variants;
  }, [product, isNumbered, numberQuery]);

  function handleNumberChange(value: string) {
    setNumberQuery(value);
    setNotFound(false);
    // Exactly one sellable match is unambiguous, so it becomes the
    // selection — which is all it becomes. Anything else (no such number,
    // sold out, or a number shared by several variants) leaves nothing
    // selected and the narrowed grid to choose from.
    const matches = variantsByNumber(product, value).filter((variant) => variant.stock > 0);
    setSelectedId(matches.length === 1 ? matches[0].id : null);
  }

  // "Done" on the phone's number pad, or Enter from a keyboard: the cashier
  // has typed a number and asked for it, so this adds what that number
  // selected. It is still the explicit act — nothing was added while they
  // were typing.
  function handleNumberSubmit(event: FormEvent) {
    event.preventDefault();
    if (selected) {
      add(selected);
      return;
    }
    setNotFound(true);
  }

  function add(variant: Variant) {
    if (variant.stock <= 0) return;
    onPick(product, variant);
    setSelectedId(null);
    setNumberQuery("");
    setNotFound(false);

    // What landed in the cart is said by the toast over this sheet, so
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
              onChange={(event) => handleNumberChange(event.target.value)}
              placeholder={t("numberPlaceholder")}
              enterKeyHint="done"
              className="text-lg"
            />
          </form>
        )}

        {notFound && <Alert variant="destructive">{t("numberNotFound")}</Alert>}

        <ul className={cn("grid gap-2", isNumbered ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-1")}>
          {visibleVariants.map((variant) => {
            const soldOut = variant.stock <= 0;
            const isSelected = variant.id === selectedId;
            const name = localize(variant.name, locale);

            return (
              <li key={variant.id}>
                <button
                  type="button"
                  disabled={soldOut}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedId(variant.id);
                    setNotFound(false);
                  }}
                  className={cn(
                    "relative flex w-full flex-col items-start justify-center gap-1 rounded-xl border p-3 text-start transition-colors",
                    "min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    isNumbered && "items-center text-center",
                    // The chosen one has to be unmistakable across a counter
                    // at arm's length, so it changes fill, border and weight
                    // at once and carries a tick — not a faint tint that
                    // disappears under a shop's lighting.
                    isSelected
                      ? "border-primary bg-primary/15 font-semibold text-foreground ring-2 ring-primary"
                      : "border-border bg-card hover:bg-accent/60"
                  )}
                >
                  {isSelected && (
                    <span
                      className="absolute end-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      aria-hidden="true"
                    >
                      <Check className="size-3.5" />
                    </span>
                  )}

                  <span className={cn("font-medium", isNumbered ? "text-xl" : "text-base")}>{name}</span>
                  <span className="text-sm text-muted-foreground">
                    {soldOut ? t("soldOut") : formatMoney(variant.resolvedPrice)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Pinned under the list: with a long grid the Add button must not be
          something you have to scroll to find, and it belongs where the
          thumb already is. */}
      <div className="flex items-center gap-2 border-t border-border bg-background px-5 pb-5 pt-3">
        <Button type="button" onClick={() => selected && add(selected)} disabled={!selected} className="flex-1">
          {selected ? t("addNamed", { name: localize(selected.name, locale) }) : t("add")}
        </Button>

        {isNumbered && (
          <Button type="button" variant="secondary" onClick={onClose} className="shrink-0">
            {t("done")}
          </Button>
        )}
      </div>
    </div>
  );
}

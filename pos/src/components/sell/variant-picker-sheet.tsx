"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Product } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { isNumberedProduct, variantsByNumber } from "@/lib/numbered";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
      <SheetContent closeLabel={tCommon("close")}>
        {product && (
          <>
            <SheetHeader>
              <SheetTitle>{localize(product.name, locale)}</SheetTitle>
              <SheetDescription>{isNumbered ? t("numberedSubtitle") : t("subtitle")}</SheetDescription>
            </SheetHeader>

            {/* Keyed by product: opening a different collection starts from
                a clean number box, never the previous one's leftovers. */}
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

// Numbered shawls (spec.md) get a fast lane: the customer says "number 4"
// over WhatsApp or points at the photo, so the cashier types 4 and presses
// add rather than hunting through a grid. The sheet stays open afterwards,
// because numbers from one collection are typically rung up several at a
// time.
function VariantPicker({ product, isNumbered, onPick, onClose }: VariantPickerProps) {
  const t = useTranslations("sell.picker");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  const [numberQuery, setNumberQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);

  // Typing a number narrows the list to it, so the grid always agrees with
  // what's in the box — and the cashier can tap the match instead of
  // pressing add, whichever is quicker for them. A number that matches
  // nothing leaves the full list up rather than emptying the sheet.
  const visibleVariants = useMemo(() => {
    if (!isNumbered || !numberQuery.trim()) return product.variants;
    const matches = variantsByNumber(product, numberQuery);
    return matches.length > 0 ? matches : product.variants;
  }, [product, isNumbered, numberQuery]);

  function add(variant: Variant) {
    if (variant.stock <= 0) return;
    onPick(product, variant);
    setLastAdded(localize(variant.name, locale));
    setNumberQuery("");
    setNotFound(false);

    if (isNumbered) {
      numberInputRef.current?.focus();
    } else {
      onClose();
    }
  }

  function handleNumberSubmit(event: FormEvent) {
    event.preventDefault();
    const matches = variantsByNumber(product, numberQuery).filter((variant) => variant.stock > 0);
    // Exactly one sellable match is unambiguous — add it. Anything else
    // (no such number, sold out, or a number shared by several variants)
    // is left for the cashier to resolve against the narrowed list.
    if (matches.length === 1) {
      add(matches[0]);
      return;
    }
    setNotFound(true);
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5">
      {isNumbered && (
        <form onSubmit={handleNumberSubmit} className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor="pos-number-entry" className="text-sm font-medium">
              {t("numberLabel")}
            </label>
            <NumericInput
              id="pos-number-entry"
              ref={numberInputRef}
              value={numberQuery}
              onChange={(event) => {
                setNumberQuery(event.target.value);
                setNotFound(false);
              }}
              placeholder={t("numberPlaceholder")}
              enterKeyHint="done"
              autoFocus
              className="text-lg"
            />
          </div>
          <Button type="submit" disabled={!numberQuery.trim()}>
            {t("addNumber")}
          </Button>
        </form>
      )}

      {notFound && <Alert variant="destructive">{t("numberNotFound")}</Alert>}
      {lastAdded && !notFound && <Alert variant="success">{t("added", { name: lastAdded })}</Alert>}

      <ul className={cn("grid gap-2", isNumbered ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-1")}>
        {visibleVariants.map((variant) => {
          const soldOut = variant.stock <= 0;
          const name = localize(variant.name, locale);

          return (
            <li key={variant.id}>
              <button
                type="button"
                disabled={soldOut}
                onClick={() => add(variant)}
                className={cn(
                  "flex w-full flex-col items-start justify-center gap-1 rounded-xl border border-border bg-card p-3 text-start transition-colors",
                  "min-h-16 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  isNumbered && "items-center text-center"
                )}
              >
                <span className={cn("font-medium", isNumbered ? "text-xl" : "text-base")}>{name}</span>
                <span className="text-sm text-muted-foreground">
                  {soldOut ? t("soldOut") : formatMoney(variant.resolvedPrice)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {isNumbered && (
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("done")}
        </Button>
      )}
    </div>
  );
}

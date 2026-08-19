"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import type { QuickSellItemInput } from "@organza/shared/schemas/order";
import {
  QUICK_SELL_DETAIL_MAX_LENGTH,
  QUICK_SELL_NAME_MAX_LENGTH,
} from "@organza/shared/constants/quickSell";
import { isNonNegativeDecimalString } from "@/lib/validation/numeric";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface QuickSellSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: QuickSellItemInput) => void;
}

// Selling something the catalogue has never heard of (spec.md "Quick sell").
//
// Stock reaches the shop floor before it reaches the system, and at the
// busiest hour of the season a queue must not wait on somebody choosing a
// category and photographing a dress. So this asks for the two things the
// SALE genuinely needs — what it is, and what the customer pays — and one
// optional third that costs a second and saves an argument later.
//
// Everything it does NOT ask for is the design: no category, no cost, no
// barcode, no photograph, no variants. Those are filled in afterwards, by
// somebody who is not standing in front of a customer, from the approvals
// screen in the admin.
//
// Two fields and a button, deliberately. Every extra box here is a second at
// the till, multiplied by the queue.
export function QuickSellSheet({ open, onOpenChange, onAdd }: QuickSellSheetProps) {
  const tCommon = useTranslations("common");
  const t = useTranslations("sell.quickSell");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent name="quick-sell" compact closeLabel={tCommon("close")}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="size-5 shrink-0 text-primary" aria-hidden="true" />
            {t("title")}
          </SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>

        {/* The form is its own component so its fields are created fresh each
            time the sheet opens — the next piece starts empty rather than
            from whatever the last one was called. */}
        {open && (
          <QuickSellForm
            onAdd={(input) => {
              onAdd(input);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function QuickSellForm({
  onAdd,
  onCancel,
}: {
  onAdd: (input: QuickSellItemInput) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("sell.quickSell");
  const currency = useCurrencySymbol();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [detail, setDetail] = useState("");

  const trimmedName = name.trim();
  const trimmedPrice = price.trim();
  const priceIsValid = isNonNegativeDecimalString(trimmedPrice);
  const canAdd = trimmedName !== "" && priceIsValid;
  // Only complain about something actually typed: an empty box is where
  // everybody starts, not a mistake worth a red line under it.
  const showPriceError = trimmedPrice !== "" && !priceIsValid;

  function submit() {
    if (!canAdd) return;
    onAdd({
      name: trimmedName,
      price: trimmedPrice,
      ...(detail.trim() ? { detail: detail.trim() } : {}),
    });
  }

  return (
    <form
      className="flex flex-col gap-4 overflow-y-auto px-5 pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="pos-quick-sell-name">{t("nameLabel")}</Label>
        {/* Autofocus: the sheet was opened to type this. On a phone that
            brings the keyboard up with the sheet rather than after a second
            tap, which is the whole second this feature exists to save. */}
        <Input
          id="pos-quick-sell-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={QUICK_SELL_NAME_MAX_LENGTH}
          autoFocus
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pos-quick-sell-price">
          {currency ? t("priceLabelCurrency", { currency }) : t("priceLabel")}
        </Label>
        {/* A price, so decimals are allowed — but still the numeric keypad
            and still no "e"/"+"/"-" (CLAUDE.md "Mobile input"). */}
        <NumericInput
          id="pos-quick-sell-price"
          allowDecimal
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder={t("pricePlaceholder")}
          aria-invalid={showPriceError}
        />
        {showPriceError && <p className="text-sm text-destructive">{t("priceInvalid")}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pos-quick-sell-detail">{t("detailLabel")}</Label>
        <Input
          id="pos-quick-sell-detail"
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder={t("detailPlaceholder")}
          maxLength={QUICK_SELL_DETAIL_MAX_LENGTH}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">{t("detailHint")}</p>
      </div>

      {/* Said once, plainly, and before the button rather than after it: the
          sale goes through now, and an Admin finishes the piece off later.
          Nobody at the till should be left wondering whether they have just
          created a mess. */}
      <Alert>{t("afterwards")}</Alert>

      {/* The primary action sits at the START edge, under where a thumb
          rests on a phone held in the reading direction — the same way round
          as the variant picker and the opposite of the gift sheet. The rule
          is what a stray tap costs: adding a line to a cart is one tap to
          undo, giving a piece away is not. */}
      <div className="flex items-stretch gap-3">
        <Button type="submit" disabled={!canAdd} data-test-selector="pos-quick-sell-add" className="min-w-0 flex-[2]">
          <Zap aria-hidden="true" />
          {t("add")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-test-selector="pos-quick-sell-cancel"
          className="min-w-24 flex-1"
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

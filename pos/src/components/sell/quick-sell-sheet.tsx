"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import type { QuickSellItemInput } from "@store/shared/schemas/order";
import { QUICK_SELL_DETAIL_MAX_LENGTH, QUICK_SELL_NAME_MAX_LENGTH } from "@store/shared/constants/quickSell";
import { isNonNegativeDecimalString } from "@/lib/validation/numeric";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
import { Alert, Button, FormField, Input } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { NumericInput } from "@/components/fields/numeric-input";
import { BottomSheet } from "@/components/sell/bottom-sheet";

interface QuickSellSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: QuickSellItemInput) => void;
}

// Selling a piece the catalogue has never seen (spec.md "Quick sell"): only a name and a price, never a category, cost or photo, so the queue never waits.
export function QuickSellSheet({ open, onOpenChange, onAdd }: QuickSellSheetProps) {
  const t = useTranslations("sell.quickSell");

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      name="quick-sell"
      compact
      title={
        <span className="flex items-center gap-2">
          <Zap className="size-5 shrink-0 text-primary-600" aria-hidden="true" />
          {t("title")}
        </span>
      }
      description={t("subtitle")}
    >
      {/* Created fresh on each open so the next piece starts empty. */}
      {open && (
        <QuickSellForm
          onAdd={(input) => {
            onAdd(input);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </BottomSheet>
  );
}

function QuickSellForm({ onAdd, onCancel }: { onAdd: (input: QuickSellItemInput) => void; onCancel: () => void }) {
  const t = useTranslations("sell.quickSell");
  const currency = useCurrencySymbol();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [detail, setDetail] = useState("");

  const trimmedName = name.trim();
  const trimmedPrice = price.trim();
  const priceIsValid = isNonNegativeDecimalString(trimmedPrice);
  const canAdd = trimmedName !== "" && priceIsValid;
  const showPriceError = trimmedPrice !== "" && !priceIsValid;

  function submit() {
    if (!canAdd) {
      return;
    }
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
      <FormField label="sell.quickSell.nameLabel" htmlFor="pos-quick-sell-name" required>
        {/* Autofocus: the sheet was opened to type this, and the keyboard coming up with it is the second this feature saves. */}
        <Input
          id="pos-quick-sell-name"
          data-testid={fieldTestSelector("pos-quick-sell-name")}

          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={QUICK_SELL_NAME_MAX_LENGTH}
          autoFocus
          autoComplete="off"
        />
      </FormField>

      <FormField
        label="sell.quickSell.priceLabel"
        htmlFor="pos-quick-sell-price"
        required
        error={showPriceError ? { type: "pattern" } : undefined}
        errorKey="sell.quickSell.priceInvalid"
      >
        <NumericInput
          id="pos-quick-sell-price"
          data-testid={fieldTestSelector("pos-quick-sell-price")}
          allowDecimal
          dir="ltr"
          suffix={currency || undefined}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder={t("pricePlaceholder")}
          aria-invalid={showPriceError}
        />
      </FormField>

      <FormField
        label="sell.quickSell.detailLabel"
        htmlFor="pos-quick-sell-detail"
        optional
        note="sell.quickSell.detailHint"
      >
        <Input
          id="pos-quick-sell-detail"
          data-testid={fieldTestSelector("pos-quick-sell-detail")}

          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder={t("detailPlaceholder")}
          maxLength={QUICK_SELL_DETAIL_MAX_LENGTH}
          autoComplete="off"
        />
      </FormField>

      <Alert tone="neutral" data-testid="alert-default">
        {t("afterwards")}
      </Alert>

      {/* Primary action at the start edge: a stray tap here only adds a cart line, unlike the gift sheet. */}
      <div className="flex items-stretch gap-3">
        <Button
          type="submit"
          disabled={!canAdd}
          data-testid="pos-quick-sell-add"
          className={"min-w-0 flex-[2]"}
          icon={<Zap aria-hidden="true" />}
        >
          {t("add")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          data-testid="pos-quick-sell-cancel"
          className={"min-w-24 flex-1"}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

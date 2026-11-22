"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Gift } from "lucide-react";
import { localize } from "@/lib/i18n-content";
import { useTranslateError } from "@/hooks/use-translate-error";
import { GIFT_NOTE_MAX_LENGTH } from "@/constants/pos";
import { Alert, Button, FormField, Textarea, Typography } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import type { CartLine } from "@/types/cart";

interface GiftOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: readonly CartLine[];
  itemCount: number;
  isSubmitting: boolean;
  // A backend error code from the failed save, shown inside the sheet that covers the screen.
  errorCode: string | null;
  // The note is the cashier's own words about who it went to, or empty.
  onConfirm: (note: string) => void;
}

// Giving the cart away (spec.md "Gifts"): stock leaves and no money comes in, so every line is shown and a second, differently-worded button commits it.
export function GiftOrderSheet({
  open,
  onOpenChange,
  lines,
  itemCount,
  isSubmitting,
  errorCode,
  onConfirm,
}: GiftOrderSheetProps) {
  const t = useTranslations("sell.gift");
  const locale = useLocale();
  const translateError = useTranslateError();

  const [note, setNote] = useState("");

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        // Backing out clears the note; a successful gift unmounts the selling screen anyway.
        if (!next) {
          setNote("");
        }
        onOpenChange(next);
      }}
      name="gift-order"
      className="max-h-[92dvh]"
      headerClassName="pb-0"
      title={
        <span className="flex items-center gap-2 text-tint-3-ink">
          <Gift className="size-5 shrink-0" aria-hidden="true" />
          {t("title")}
        </span>
      }
      description={t("subtitle")}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        {/* The warning comes before the list: nobody scrolls to a warning under a long cart. */}
        <Alert tone="warning" icon="gift" data-testid="alert-default">
          {t("warning")}
        </Alert>

        <div className="flex flex-col gap-2">
          <Typography as="h3" variant="small" weight="medium">
            {t("itemsTitle", { count: itemCount })}
          </Typography>
          <ul className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-3">
            {lines.map((line) => {
              const name = localize(line.name, locale);
              const variantName = line.variantName ? localize(line.variantName, locale) : null;
              return (
                <li key={line.key} className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Typography as="span" variant="small" weight="medium" className="truncate">
                      {name}
                    </Typography>
                    {variantName && (
                      <Typography as="span" variant="small" tone="muted" className="truncate">
                        {variantName}
                      </Typography>
                    )}
                  </span>
                  <Typography as="span" variant="small" weight="semibold" className="shrink-0 tabular-nums">
                    {t("quantity", { count: line.quantity })}
                  </Typography>
                </li>
              );
            })}
          </ul>
        </div>

        <FormField label="sell.gift.noteLabel" htmlFor="pos-gift-note" optional note="sell.gift.noteHint">
          <Textarea
            id="pos-gift-note"
            data-testid={fieldTestSelector("pos-gift-note")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("notePlaceholder")}
            maxLength={GIFT_NOTE_MAX_LENGTH}
            rows={3}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-5 pt-4">
        {errorCode && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(errorCode)}
          </Alert>
        )}

        {/* The way out is at the start edge and committing the gift is a deliberate reach to the far end: a stray tap here costs a piece. */}
        <div className="flex items-stretch gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            data-testid="pos-gift-cancel"
            disabled={isSubmitting}
            className={"min-w-28 flex-1"}
          >
            {t("cancel")}
          </Button>

          <Button
            type="button"
            onClick={() => onConfirm(note)}
            data-testid="pos-gift-confirm"
            isLoading={isSubmitting}
            icon={<Gift aria-hidden="true" />}
            className="min-w-0 flex-1"
          >
            {isSubmitting ? t("saving") : t("confirm")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

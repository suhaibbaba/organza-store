"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Gift } from "lucide-react";
import { localize } from "@/lib/i18n-content";
import { useTranslateError } from "@/hooks/use-translate-error";
import { GIFT_NOTE_MAX_LENGTH } from "@/constants/pos";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { CartLine } from "@/types/cart";

interface GiftOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: readonly CartLine[];
  itemCount: number;
  isSubmitting: boolean;
  // A backend error code from the failed save, or null. Rendered inside the
  // sheet, which covers the screen — behind it the cashier would never see it.
  errorCode: string | null;
  // The note is the cashier's own words about who it went to, or empty.
  onConfirm: (note: string) => void;
}

// Giving the open cart away instead of selling it (spec.md "Gifts").
//
// The sheet exists because the tap behind it must not be the last one. Stock
// walks out of the shop on this action and no money comes back, so the
// cashier is shown exactly what is about to go — every line, by name, with
// its quantity — and has to press a second, differently-worded button under
// it. "Give as gift" in the checkout bar only ever opens this.
//
// It is drawn in the gift colour from top to bottom, which is not the colour
// anything that takes money is drawn in, so there is no moment where this
// looks like the sale it sits next to.
//
// The note is optional and free text: "for the bride's mother", "replacement
// after the complaint". It is the only record of WHY the shop is a piece
// down, and it rides along on the order itself (Order.note), which is what
// the admin sees when the month's giveaways are read back.
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
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const translateError = useTranslateError();

  const [note, setNote] = useState("");

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Backing out of a gift is backing out of it entirely: the next one
        // starts from an empty note rather than from whoever the last one
        // was for. A gift that SUCCEEDS unmounts the whole selling screen
        // (see SellScreen), so that path clears itself.
        if (!next) setNote("");
        onOpenChange(next);
      }}
    >
      <SheetContent name="gift-order" side="bottom" closeLabel={tCommon("close")} className="max-h-[92dvh]">
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2 text-gift">
            <Gift className="size-5 shrink-0" aria-hidden="true" />
            {t("title")}
          </SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>

        {/* The list scrolls; what commits the gift stays pinned under the
            thumb, like every other sheet on this screen. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
          {/* Said before the list, not after it: this is the sentence the
              cashier has to have read, and a warning under a long cart is a
              warning nobody scrolled to. */}
          <Alert className="border-gift/30 bg-gift/10 text-gift">
            <Gift className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t("warning")}</span>
          </Alert>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">{t("itemsTitle", { count: itemCount })}</h3>
            {/* Named and counted, because "3 pieces" is not something anyone
                can check. This is the last chance to notice that the cart
                still has the customer's dress in it. */}
            <ul className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              {lines.map((line) => {
                const name = localize(line.name, locale);
                const variantName = line.variantName ? localize(line.variantName, locale) : null;
                return (
                  <li key={line.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{name}</span>
                      {variantName && <span className="block truncate text-muted-foreground">{variantName}</span>}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {t("quantity", { count: line.quantity })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="pos-gift-note" className="text-sm font-medium">
              {t("noteLabel")}
            </label>
            <Textarea
              id="pos-gift-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("notePlaceholder")}
              maxLength={GIFT_NOTE_MAX_LENGTH}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{t("noteHint")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 pt-4">
          {errorCode && <Alert variant="destructive">{translateError(errorCode)}</Alert>}

          {/* Two buttons, and the one that gives the stock away is the one
              that has to be reached for. The way out sits at the start edge,
              under where a thumb rests on a phone held in the reading
              direction; committing the gift is a deliberate reach across to
              the far end.

              That is the opposite of the variant picker, whose primary action
              is the near one — on purpose. There, the worst a stray tap costs
              is a line removed from a cart. Here it is a piece out of the
              shop.

              Both buttons say what they do rather than "yes"/"no": "confirm"
              on its own would be equally true of the sale this is sitting on
              top of. */}
          <div className="flex items-stretch gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-test-selector="pos-gift-cancel"
              disabled={isSubmitting}
              className="min-w-28 flex-1"
            >
              {t("cancel")}
            </Button>

            <Button
              type="button"
              variant="gift"
              onClick={() => onConfirm(note)}
              data-test-selector="pos-gift-confirm"
              disabled={isSubmitting}
              className="min-w-0 flex-1"
            >
              {isSubmitting ? <Spinner /> : <Gift aria-hidden="true" />}
              {isSubmitting ? t("saving") : t("confirm")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

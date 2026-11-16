"use client";

import { useTranslations } from "next-intl";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";

interface CollectionActionBarProps {
  count: number;
  amount: string;
  isPending: boolean;
  onConfirm: () => void;
  onClear: () => void;
}

// The "we've been paid for these" bar. Fixed to the bottom of the screen so
// the action stays under the thumb however far the list is scrolled, and it
// only appears once something is selected — an empty bar would just eat
// screen on a phone.
//
// It is anchored one --bottom-bar-inset off the bottom, which is the nav's
// height plus the iOS home-indicator strip (globals.css), so it lands exactly
// on top of the nav on a phone and clears the indicator on the wider screens
// where the nav is hidden (CLAUDE.md "Mobile input & device specifics").
export function CollectionActionBar({
  count,
  amount,
  isPending,
  onConfirm,
  onClear,
}: CollectionActionBarProps) {
  const t = useTranslations("orders.collection.actions");
  const formatMoney = useMoneyFormatter();

  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-[var(--bottom-bar-inset)] z-30 border-t border-border bg-background px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t("selected", { count })}</span>
          <span className="text-base font-semibold tabular-nums text-foreground">{formatMoney(amount)}</span>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="h-12 shrink-0 px-4" onClick={onClear}>
            {t("clear")}
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 text-base"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? <Spinner /> : <HandCoins className="size-5" aria-hidden="true" />}
            {t("markCollected", { count })}
          </Button>
        </div>
      </div>
    </div>
  );
}

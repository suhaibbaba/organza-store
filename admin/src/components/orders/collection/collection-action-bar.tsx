"use client";

import { useTranslations } from "next-intl";
import { HandCoins } from "lucide-react";
import { Button } from "@store/ui";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";

interface CollectionActionBarProps {
  count: number;
  amount: string;
  isPending: boolean;
  onConfirm: () => void;
  onClear: () => void;
}

// Sits one --bottom-bar-inset up (nav height + iOS home indicator), so it lands on top of the phone nav.
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
    <div className="fixed inset-x-0 bottom-[var(--bottom-bar-inset)] z-30 border-t border-line bg-surface px-4 py-3 shadow-float md:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-label text-ink-muted">{t("selected", { count })}</span>
          <span className="text-section font-semibold tabular-nums text-ink">{formatMoney(amount)}</span>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="h-12 shrink-0 px-4" onClick={onClear}>
            {t("clear")}
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 text-section"
            isLoading={isPending}
            onClick={onConfirm}
            icon={<HandCoins className="size-5" aria-hidden="true" />}
          >
            {t("markCollected", { count })}
          </Button>
        </div>
      </div>
    </div>
  );
}

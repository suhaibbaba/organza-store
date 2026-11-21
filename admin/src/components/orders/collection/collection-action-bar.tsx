"use client";

import { useTranslations } from "next-intl";
import { HandCoins } from "lucide-react";
import { Button, STICKY_PRIMARY_CLASS, STICKY_SECONDARY_CLASS, StickyActions } from "@store/ui";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { CollectionActionBarProps } from "@/types/order";

// The same floating pill as a SaveBar: what is ticked and its total, Clear, then the one action.
export function CollectionActionBar({ count, amount, isPending, onConfirm, onClear }: CollectionActionBarProps) {
  const t = useTranslations("orders.collection.actions");
  const formatMoney = useMoneyFormatter();

  return (
    <StickyActions
      data-testid="collection-actions"
      visible={count > 0}
      tone="primary"
      size="md"
      label={t("label")}
      message={
        <>
          {t("selected", { count })} · <span className="font-semibold tabular-nums">{formatMoney(amount)}</span>
        </>
      }
    >
      <Button
        variant="quiet"
        className={STICKY_SECONDARY_CLASS}
        onClick={onClear}
        data-test-selector="collection-actions-clear"
      >
        {t("clear")}
      </Button>
      <Button
        className={STICKY_PRIMARY_CLASS}
        isLoading={isPending}
        onClick={onConfirm}
        icon={<HandCoins className="size-4" aria-hidden="true" />}
        data-test-selector="collection-actions-confirm"
      >
        {t("confirm")}
      </Button>
    </StickyActions>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import { Repeat, X } from "lucide-react";
import { Button, IconButton, Typography } from "@store/ui";
import { localize } from "@/lib/i18n-content";
import { returnedPieceCount } from "@/lib/exchange";
import type { ExchangeCartState } from "@/types/exchange";

interface ExchangeBannerProps {
  exchange: ExchangeCartState;
}

// Says, above the new pieces, that this cart is an exchange: of which sale, and what came back.
export function ExchangeBanner({ exchange }: ExchangeBannerProps) {
  const t = useTranslations("sell.exchange");
  const locale = useLocale();
  const names = exchange.returns
    .map((line) => {
      const name = localize(line.name, locale);
      const label = line.variantName ? `${name} — ${localize(line.variantName, locale)}` : name;
      return line.quantity > 1 ? t("pieceTimes", { name: label, count: line.quantity }) : label;
    })
    .join(t("itemSeparator"));

  return (
    <div
      className="mx-4 mt-3 flex shrink-0 items-start gap-3 rounded-panel border border-primary-200 bg-primary-50 px-3 py-2.5 desk:mx-5"
      data-test-selector="pos-exchange-banner"
    >
      <Repeat className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Typography variant="small" weight="semibold">
          {t("bannerTitle", {
            order: t("orderNumber", { number: exchange.orderNumber }),
            count: returnedPieceCount(exchange.returns),
          })}
        </Typography>
        <Typography variant="caption" tone="muted" className="break-words">
          {names}
        </Typography>
        <Button
          type="button"
          variant="quiet"
          onClick={exchange.onEdit}
          data-testid="pos-exchange-edit"
          className="self-start px-0"
        >
          {t("editReturns")}
        </Button>
      </div>
      <IconButton
        label={t("cancel")}
        icon={<X className="size-5" aria-hidden="true" />}
        onClick={exchange.onCancel}
        data-testid="pos-exchange-cancel"
        className="-me-1 -mt-1"
      />
    </div>
  );
}

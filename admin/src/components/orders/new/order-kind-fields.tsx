"use client";

import { Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField, SegmentedControl, Switch, Typography } from "@store/ui";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { MANUAL_ORDER_CHANNELS } from "@/constants/orders";
import type { OrderKindFieldsProps } from "@/types/order";

export function OrderKindFields({ control, channel, isGift, canGift }: OrderKindFieldsProps) {
  const t = useTranslations("orders.new.kind");
  const options = MANUAL_ORDER_CHANNELS.map((option) => ({ value: option, label: t(`options.${option}`) }));

  return (
    <div className="flex flex-col divide-y divide-line">
      <div className="flex flex-col gap-2 pb-4">
        <Controller
          control={control}
          name="channel"
          render={({ field }) => (
            <SegmentedControl
              data-testid={fieldTestSelector("order-channel")}
              label={t("label")}
              options={options}
              value={field.value}
              onChange={field.onChange}
              className="self-start"
            />
          )}
        />
        <Typography variant="caption" tone="muted" as="p">{t(isGift ? `giftHints.${channel}` : `hints.${channel}`)}</Typography>
      </div>

      {canGift && (
        <div className="pt-4">
          <FormField label="orders.new.kind.gift" htmlFor="order-gift" note="orders.new.kind.giftHint">
          <Controller
            control={control}
            name="gift"
            render={({ field }) => (
              <Switch
                id="order-gift"
                data-testid={fieldTestSelector("order-gift")}
                label={t("gift")}
                hideLabel
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          </FormField>
        </div>
      )}
    </div>
  );
}

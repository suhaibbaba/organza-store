"use client";

import type { ComponentProps } from "react";
import { currencySymbol } from "@store/ui/lib/support/currencies";
import { NumericInput } from "@/components/fields/numeric-input";
import { useSettingsQuery } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

type MoneyFieldProps = Omit<ComponentProps<typeof NumericInput>, "allowDecimal" | "suffix" | "dir">;

export function MoneyField({ className, ...props }: MoneyFieldProps) {
  const { data: settings } = useSettingsQuery();
  const symbol = currencySymbol(settings?.currency);

  return (
    <NumericInput
      allowDecimal
      dir="ltr"
      className={cn("tabular-nums", className)}
      {...(symbol !== "" && { suffix: symbol })}
      {...props}
    />
  );
}

import { currencySymbol, formatCentsMoney, formatWholeMoney } from "@ui/lib/support";
import type { JSX } from "react";
import { Ltr } from "@ui/components/ltr";
import { useLocaleFormat } from "@ui/components/locale-format";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface MoneyProps extends TestIdProps {
  readonly amount: string;
  readonly currency?: string | undefined;
  readonly className?: string | undefined;
  readonly signed?: boolean | undefined;
  readonly cents?: boolean | undefined;
}

export function Money({
  amount,
  currency,
  className,
  signed = false,
  cents = false,
  "data-testid": testId,
}: MoneyProps): JSX.Element {
  const part = parts("money", testId);
  const negative = amount.startsWith("-");
  const zero = Number(amount) === 0;
  const symbol = currencySymbol(currency);
  const { separators } = useLocaleFormat();

  return (
    <span
      {...part()}
      className={cn(
        "tabular-nums",
        signed && !zero && (negative ? "text-success-700" : "text-danger-700"),
        className,
      )}
    >
      <Ltr {...part("figure")}>
        {cents ? formatCentsMoney(amount, separators) : formatWholeMoney(amount, separators)}
        {symbol !== "" && (
          <>
            {"\u00A0"}
            {symbol}
          </>
        )}
      </Ltr>
    </span>
  );
}

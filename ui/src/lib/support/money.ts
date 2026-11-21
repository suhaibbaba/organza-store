// Formatting an amount held as a decimal string ("1250.50") — never a float.
// Ported from the clinic system's shared package without its zod schemas.
import { DEFAULT_NUMBER_SEPARATORS, groupDigits, type NumberSeparators } from "@ui/lib/support/numbers";

export function formatWholeMoney(
  amount: string,
  separators: NumberSeparators = DEFAULT_NUMBER_SEPARATORS,
): string {
  const negative = amount.startsWith("-");
  const [whole = "0"] = (negative ? amount.slice(1) : amount).split(".");

  return `${negative ? "-" : ""}${groupDigits(whole, separators.group)}`;
}

export function formatCentsMoney(
  amount: string,
  separators: NumberSeparators = DEFAULT_NUMBER_SEPARATORS,
): string {
  const negative = amount.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? amount.slice(1) : amount).split(".");
  const cents = fraction.padEnd(2, "0").slice(0, 2);
  const grouped = groupDigits(whole, separators.group);

  return `${negative ? "-" : ""}${grouped}${cents === "00" ? "" : `${separators.decimal}${cents}`}`;
}

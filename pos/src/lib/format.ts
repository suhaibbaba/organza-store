import { MONEY_DECIMAL_PLACES } from "@organza/shared/constants/order";

// Intl's percent style takes a ratio; a discount is stored as the percentage
// itself ("2" meaning 2%).
const PERCENT_RATIO_DIVISOR = 100;

// Currency formatting reads the code from Settings (CLAUDE.md rule 14) —
// never hard-code a symbol or default currency here.
export function formatMoney(amount: string | number, currency: string, locale: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

// The currency's own symbol, as the current language writes it — read out of
// the same Intl formatter every price goes through, so a label that NAMES the
// currency ("Amount (₪)") can never drift from the figures beside it. Falls
// back to the code, which is still true, just less pretty.
export function currencySymbol(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

// A percentage discount, written the way the current language writes one —
// which is not always "N%" after the digits. Kept to the same 2 places as
// money (lib/money.ts carries percentages as hundredths of a percent), so
// "12.5" reads back as it was typed rather than as 12.50.
export function formatPercent(value: string | number, locale: string): string {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed)) return "";
  try {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: MONEY_DECIMAL_PLACES,
    }).format(parsed / PERCENT_RATIO_DIVISOR);
  } catch {
    return `${parsed}%`;
  }
}

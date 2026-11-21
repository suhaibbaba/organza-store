import { DATE_FORMAT_BASE, NUMBER_FORMAT_BASE } from "@organza/shared/constants/formatting";
import { MONEY_DECIMAL_PLACES } from "@organza/shared/constants/order";

// Every figure starts from the shared formatting base, so the till, phone and labels show the same digits.

// A discount is stored as the percentage itself, Intl wants a ratio.
const PERCENT_RATIO_DIVISOR = 100;

// The currency comes from Settings (rule 14), never hard-coded.
export function formatMoney(amount: string | number, currency: string, locale: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(locale, { ...NUMBER_FORMAT_BASE, style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

// The currency's symbol from the same formatter as prices, falling back to the code.
export function currencySymbol(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { ...NUMBER_FORMAT_BASE, style: "currency", currency }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

// Two places like money, so 12.5 reads back as typed.
export function formatPercent(value: string | number, locale: string): string {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed)) return "";
  try {
    return new Intl.NumberFormat(locale, {
      ...NUMBER_FORMAT_BASE,
      style: "percent",
      maximumFractionDigits: MONEY_DECIMAL_PLACES,
    }).format(parsed / PERCENT_RATIO_DIVISOR);
  } catch {
    return `${parsed}%`;
  }
}

function formatMoment(value: string | null | undefined, locale: string, options: Intl.DateTimeFormatOptions): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { ...DATE_FORMAT_BASE, ...options }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatDate(value: string | null | undefined, locale: string): string {
  return formatMoment(value, locale, { dateStyle: "medium" });
}

export function formatDateTime(value: string | null | undefined, locale: string): string {
  return formatMoment(value, locale, { dateStyle: "medium", timeStyle: "short" });
}

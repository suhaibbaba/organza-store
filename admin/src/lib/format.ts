import { MS_PER_DAY } from "@store/shared/constants/time";
import { DATE_FORMAT_BASE, NUMBER_FORMAT_BASE } from "@store/shared/constants/formatting";

// Every figure and date goes through these helpers, from the shared base, so digits match on every device.

// The currency code comes from Settings (rule 14); never hard-code a symbol.
export function formatMoney(amount: string | number, currency: string, locale: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(locale, { ...NUMBER_FORMAT_BASE, style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function formatNumber(value: number, locale: string): string {
  if (!Number.isFinite(value)) return "";
  try {
    return new Intl.NumberFormat(locale, NUMBER_FORMAT_BASE).format(value);
  } catch {
    return String(value);
  }
}

// The symbol from the same formatter as the prices, so a label naming the currency never drifts from them.
export function currencySymbol(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { ...NUMBER_FORMAT_BASE, style: "currency", currency }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

// Gregorian calendar and western digits, so a date matches the counter screen and the courier's paperwork.
export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { ...DATE_FORMAT_BASE, dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { ...DATE_FORMAT_BASE, dateStyle: "medium" }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatTime(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { ...DATE_FORMAT_BASE, timeStyle: "short" }).format(date);
  } catch {
    return date.toISOString();
  }
}

// Whole days from a moment until now; 0 on the same day.
export function daysSince(value: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / MS_PER_DAY));
}

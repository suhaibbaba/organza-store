import { DATE_FORMAT_BASE, NUMBER_FORMAT_BASE } from "@organza/shared/constants/formatting";

// Every figure and every date in this app is written through one of the four
// functions below, and each of them starts from the shared base
// (@organza/shared/constants/formatting) — so the digits are the shop's
// digits on every device rather than whatever the phone's region prefers.

// Currency formatting reads the code from Settings (CLAUDE.md rule 14) —
// never hard-code a symbol or default currency here.
export function formatMoney(amount: string | number, currency: string, locale: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(locale, { ...NUMBER_FORMAT_BASE, style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

// A plain count — order numbers, pending badges, quantities. Same digits as
// the money beside it, which is the whole point of routing it through here
// rather than calling Intl on the spot.
export function formatNumber(value: number, locale: string): string {
  if (!Number.isFinite(value)) return "";
  try {
    return new Intl.NumberFormat(locale, NUMBER_FORMAT_BASE).format(value);
  } catch {
    return String(value);
  }
}

// The currency's own symbol, as the current language writes it — read out of
// the same Intl formatter every price goes through, so a label that NAMES the
// currency ("Amount (₪)") can never drift from the figures beside it. Falls
// back to the code, which is still true, just less pretty.
export function currencySymbol(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { ...NUMBER_FORMAT_BASE, style: "currency", currency }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

// Order timestamps arrive as ISO strings. Rendered in the user's own locale —
// Arabic gets its own month names — but on the Gregorian calendar and in
// western digits, so a date on the phone can be matched against the same date
// on the counter screen and on a delivery company's paperwork.
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

// Date only — for the list cards, where the time of day is noise.
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

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

// Order timestamps arrive as ISO strings. Rendered in the user's own locale
// and calendar (Intl gives Arabic its own numerals and month names), which is
// what "dates render correctly" means for an Arabic-first UI. An unparseable
// value renders as nothing rather than "Invalid Date".
export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
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
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
  } catch {
    return date.toISOString();
  }
}

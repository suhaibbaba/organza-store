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

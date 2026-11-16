/**
 * Every number is formatted with western digits and every date in the Gregorian calendar, in
 * every language: iOS 15's ICU renders `ar` with Arabic-Indic digits, and some Arabic regional
 * settings switch to another calendar. Carried over from the current system.
 */
const NUMBER_BASE = { numberingSystem: 'latn' } as const;
const DATE_BASE = { numberingSystem: 'latn', calendar: 'gregory' } as const;

function locale(language: string): string {
  return language === 'ar' ? 'ar-u-nu-latn' : language;
}

export function formatNumber(value: number, language: string, digits = 0): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(locale(language), {
    ...NUMBER_BASE,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatMoney(amount: string | number, currency: string, language: string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(locale(language), {
      ...NUMBER_BASE,
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatDate(value: string | Date, language: string): string {
  return new Intl.DateTimeFormat(locale(language), { ...DATE_BASE, dateStyle: 'medium' }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string | Date, language: string): string {
  return new Intl.DateTimeFormat(locale(language), {
    ...DATE_BASE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

/** Arabic-Indic and Persian digits typed on a phone become western digits. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

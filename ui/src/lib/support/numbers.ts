export interface NumberSeparators {
  readonly group: string;
  readonly decimal: string;
}

export const DEFAULT_NUMBER_SEPARATORS: NumberSeparators = { group: ",", decimal: "." };

const cache = new Map<string, NumberSeparators>();

export function numberSeparators(numberLocale: string | null | undefined): NumberSeparators {
  if (!numberLocale) {
    return DEFAULT_NUMBER_SEPARATORS;
  }

  const cached = cache.get(numberLocale);

  if (cached) {
    return cached;
  }

  let separators = DEFAULT_NUMBER_SEPARATORS;

  try {
    const parts = new Intl.NumberFormat(numberLocale).formatToParts(1234567.5);
    const read = (type: Intl.NumberFormatPartTypes, fallback: string): string =>
      parts.find((part) => part.type === type)?.value ?? fallback;

    separators = { group: read("group", ","), decimal: read("decimal", ".") };
  } catch {}

  cache.set(numberLocale, separators);

  return separators;
}

export const groupDigits = (whole: string, group: string): string =>
  whole.replace(/\B(?=(\d{3})+$)/g, group);

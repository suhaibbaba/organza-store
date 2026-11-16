/**
 * Arabic-aware search normalisation, ported from the current system: strips diacritics,
 * unifies alef/yaa/taa marbuta/hamza forms, turns Arabic-Indic digits into western ones and
 * lower-cases. Applied both to the stored search text and to every query.
 */
const TASHKEEL = /[ً-ْٰـ]/g;

export function normalizeSearch(input: string): string {
  return toLatinDigits(input)
    .replace(TASHKEEL, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

type Translations = { ar?: string; en?: string; he?: string } | null | undefined;

/** One string holding every language of every field, normalised. */
export function buildSearchText(...fields: (Translations | string)[]): string {
  return fields
    .flatMap((f) => (typeof f === 'string' ? [f] : f ? Object.values(f) : []))
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map(normalizeSearch)
    .join(' ');
}

export function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Picks the text for a language, falling back to Arabic, then to any language. */
export function localize(value: Translations, language: string): string {
  if (!value) return '';
  const v = value as Record<string, string | undefined>;
  return v[language] || value.ar || value.en || value.he || '';
}

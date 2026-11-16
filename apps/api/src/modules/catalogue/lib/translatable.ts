import type { Translatable } from '../../../database/schema/index.js';

/** Drops empty languages so stored JSON only holds real text. */
export function cleanTranslatable(value: Translatable | undefined | null): Translatable {
  const out: Translatable = {};
  for (const key of ['ar', 'en', 'he'] as const) {
    const text = value?.[key]?.trim();
    if (text) out[key] = text;
  }
  return out;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

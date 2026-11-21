import {
  ARABIC_ARTICLE_MIN_WORD_LENGTH,
  ARABIC_DEFINITE_ARTICLE,
  ARABIC_PROCLITIC_MIN_WORD_LENGTH,
  ARABIC_PROCLITICS,
} from "@/constants/search";
import type { I18n } from "@/types";

// Strips tashkeel and tatweel and unifies similar Arabic letters; prisma/dev/demo-seed.ts imports this same function.
export function normalize(input: string): string {
  return input
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .trim();
}

function withoutArticle(word: string): string | null {
  return word.length >= ARABIC_ARTICLE_MIN_WORD_LENGTH && word.startsWith(ARABIC_DEFINITE_ARTICLE)
    ? word.slice(ARABIC_DEFINITE_ARTICLE.length)
    : null;
}

function withoutProclitic(word: string): string | null {
  return word.length >= ARABIC_PROCLITIC_MIN_WORD_LENGTH && ARABIC_PROCLITICS.some((p) => word.startsWith(p))
    ? word.slice(1)
    : null;
}

function indexForms(word: string): string[] {
  const forms = new Set([word]);
  const bare = withoutProclitic(word);
  if (bare) {
    forms.add(bare);
  }
  for (const form of [...forms]) {
    const stem = withoutArticle(form);
    if (stem) {
      forms.add(stem);
    }
  }
  return [...forms];
}

// Each word plus its forms without ال and an attached و/ب/ل, so "ابيض" finds "وابيض" and "فستان" finds "الفستان".
export function withArticleVariants(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const extra = words.flatMap((w) => indexForms(w).slice(1));
  return [...words, ...extra].join(" ");
}

// A query word typed with ال is searched without it; the index holds that form for every word.
export function normalizeQuery(query: string): string {
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => withoutArticle(word) ?? word)
    .join(" ");
}

export function normalizedValues(field: unknown): string[] {
  if (!field || typeof field !== "object") {
    return [];
  }
  return Object.values(field as I18n)
    .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
    .map(normalize);
}

// Product.searchText: every stored language's name and description, normalized (CLAUDE.md rule 10).
export function buildSearchText(...fields: (I18n | null | undefined)[]): string {
  return fields.flatMap((f) => normalizedValues(f)).join(" ");
}

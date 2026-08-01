// Isolated search layer (CLAUDE.md rule 10 & spec.md "Search"). Swappable for
// a future engine (e.g. Meilisearch) without touching callers — everything
// outside this file talks to `searchProductIds`, never to pg_trgm directly.
import { prisma } from "./prisma";

export type I18n = Record<string, string | null | undefined>;

// Normalizes Arabic text for cross-language, typo-tolerant matching: strips
// tashkeel/diacritics and unifies visually/phonetically similar letters.
// Kept in sync with prisma/seed.ts, which imports this same function so the
// two normalizers can never drift apart.
export function normalize(input: string): string {
  return input
    .replace(/[\u064B-\u0652\u0670]/g, "") // tashkeel/diacritics
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .trim();
}

// Builds Product.searchText = normalized concatenation of ALL stored
// languages' name + description. Call this on every create/update that
// touches name/description so searchText never goes stale.
export function buildSearchText(...fields: (I18n | null | undefined)[]): string {
  return fields
    .filter((f): f is I18n => Boolean(f))
    .flatMap((f) => Object.values(f))
    .filter((v): v is string => Boolean(v))
    .map((v) => normalize(v))
    .join(" ");
}

// Fuzzy + substring match against searchText via pg_trgm, ranked by
// similarity. Returns matching Product ids only (deletedAt IS NULL) — callers
// combine this with their own structured filters (category, price, etc).
//
// searchText concatenates every language's name+description into one long
// string, so whole-string `similarity()` dilutes a short query into near-zero
// scores (e.g. "فستن" vs. the full evening-dress blob scores ~0.05).
// `word_similarity()` instead matches the query against the best-fitting
// substring of searchText, which is what makes single-word typo tolerance
// actually work here.
export async function searchProductIds(query: string, limit = 500): Promise<string[]> {
  const q = normalize(query);
  if (!q) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE "deletedAt" IS NULL
      AND (word_similarity(${q}, "searchText") > 0.35 OR "searchText" ILIKE ${"%" + q + "%"})
    ORDER BY word_similarity(${q}, "searchText") DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.id);
}

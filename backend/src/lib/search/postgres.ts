import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TRIGRAM_WORD_SIMILARITY_THRESHOLD } from "@/constants/search";
import { normalize } from "@/lib/search/normalize";
import type { ProductSearchOptions } from "@/types/search";

// The old database search, kept as the fallback; word_similarity because whole-string similarity dilutes a short query to ~0.
export async function postgresSearchProductIds(
  query: string,
  limit: number,
  options: ProductSearchOptions = {},
): Promise<string[]> {
  const q = normalize(query);
  if (!q) {
    return [];
  }
  const activeOnly = options.activeOnly ? Prisma.sql`AND "isActive" = true` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE "deletedAt" IS NULL ${activeOnly}
      AND (word_similarity(${q}, "searchText") > ${TRIGRAM_WORD_SIMILARITY_THRESHOLD} OR "searchText" ILIKE ${"%" + q + "%"})
    ORDER BY word_similarity(${q}, "searchText") DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.id);
}

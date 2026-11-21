import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Position of each id in the ranked search result; ids the search did not rank (a SKU substring match) go last.
export function rankOf(ranked: string[]): (id: string) => number {
  const positions = new Map(ranked.map((id, index) => [id, index]));
  return (id) => positions.get(id) ?? ranked.length;
}

export function isRelevanceSort(
  query: { sortBy: string; sortDir: string },
  defaultSort: { sortBy: string; sortDir: string }
): boolean {
  return query.sortBy === defaultSort.sortBy && query.sortDir === defaultSort.sortDir;
}

// Filters in the database, orders by the search's rank, then loads only the requested page.
export async function pageByRelevance<T extends { id: string }>(
  ranked: string[],
  where: Prisma.ProductWhereInput,
  page: number,
  pageSize: number,
  load: (ids: string[]) => Promise<T[]>
): Promise<{ total: number; products: T[] }> {
  const rank = rankOf(ranked);
  const matching = await prisma.product.findMany({ where, select: { id: true } });
  const ordered = matching.map((row) => row.id).sort((a, b) => rank(a) - rank(b));
  const pageIds = ordered.slice((page - 1) * pageSize, page * pageSize);
  const rows = pageIds.length ? await load(pageIds) : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  return { total: ordered.length, products: pageIds.map((id) => byId.get(id)).filter((row): row is T => Boolean(row)) };
}

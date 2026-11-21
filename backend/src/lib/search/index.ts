// Isolated search layer (CLAUDE.md rule 10): callers use only these exports, never an engine directly.
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import {
  INDEX_SYNC_WAIT_MS,
  REINDEX_BATCH_SIZE,
  REINDEX_SUFFIX,
  SEARCH_ENGINES,
  SEARCH_ERROR_REPORT_INTERVAL_MS,
  SEARCH_PRODUCT_INCLUDE,
  SEARCH_RESULT_LIMIT,
  SEARCH_SYNC_BATCH_MS,
} from "@/constants/search";
import { PRODUCTS_INDEX_VERSION } from "@/constants/searchIndex";
import { meilisearchConfig } from "@/lib/search/config";
import { toSearchDocument } from "@/lib/search/documents";
import {
  meiliApplySettings,
  meiliDelete,
  meiliDeleteIndex,
  meiliHealthy,
  meiliSearchIds,
  meiliSwapIndexes,
  meiliUpsert,
  waitForTask,
} from "@/lib/search/meilisearch";
import { postgresSearchProductIds } from "@/lib/search/postgres";
import type {
  SearchCategoryNode,
  MeilisearchConfig,
  ProductSearchOptions,
  ReindexSummary,
  SearchEngineStatus,
  SearchProductRow,
} from "@/types/search";

export { buildSearchText, normalize } from "@/lib/search/normalize";

let lastReportedAt = 0;
function reportSearchFailure(error: unknown, context: Record<string, unknown>): void {
  const now = Date.now();
  if (now - lastReportedAt < SEARCH_ERROR_REPORT_INTERVAL_MS) {
    return;
  }
  lastReportedAt = now;
  captureException(error, { area: "search", ...context });
}

let settingsApplied: Promise<unknown> | null = null;
function ensureSettings(config: MeilisearchConfig): Promise<unknown> {
  settingsApplied ??= meiliApplySettings(config, config.index).catch((error) => {
    settingsApplied = null;
    throw error;
  });
  return settingsApplied;
}

async function loadCategories(): Promise<Map<string, SearchCategoryNode>> {
  const rows = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
  return new Map(rows.map((row) => [row.id, row]));
}

// Product ids matching the query, closest match first; a Meilisearch failure falls back to pg_trgm so the till never loses search.
export async function searchProductIds(query: string, options: ProductSearchOptions = {}): Promise<string[]> {
  const limit = options.limit ?? SEARCH_RESULT_LIMIT;
  const config = meilisearchConfig();
  if (config) {
    try {
      return await meiliSearchIds(config, query, limit, options);
    } catch (error) {
      reportSearchFailure(error, { op: "search" });
    }
  }
  return postgresSearchProductIds(query, limit, options);
}

async function syncProducts(config: MeilisearchConfig, ids: string[], waitMs?: number): Promise<void> {
  await ensureSettings(config);
  const [rows, categories] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids } }, include: SEARCH_PRODUCT_INCLUDE }),
    loadCategories(),
  ]);
  const live = rows.filter((r) => !r.deletedAt);
  const liveIds = new Set(live.map((r) => r.id));
  const gone = ids.filter((id) => !liveIds.has(id));
  const tasks = [
    ...(live.length
      ? [
          await meiliUpsert(
            config,
            config.index,
            live.map((r) => toSearchDocument(r, categories)),
          ),
        ]
      : []),
    ...(gone.length ? [await meiliDelete(config, config.index, gone)] : []),
  ];
  if (waitMs !== undefined) {
    await Promise.all(tasks.map((task) => waitForTask(config, task, waitMs)));
  }
}

// Re-indexes these products now and waits briefly so a save is searchable on return; never rejects, so it can never fail a save.
export async function indexProducts(ids: (string | null | undefined)[]): Promise<void> {
  const config = meilisearchConfig();
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!config || !unique.length) {
    return;
  }
  try {
    await syncProducts(config, unique, INDEX_SYNC_WAIT_MS);
  } catch (error) {
    reportSearchFailure(error, { op: "index", ids: unique });
  }
}

const pending = new Set<string>();
let flushTimer: NodeJS.Timeout | null = null;

function flushQueue(): void {
  flushTimer = null;
  const config = meilisearchConfig();
  const ids = [...pending];
  pending.clear();
  if (!config || !ids.length) {
    return;
  }
  syncProducts(config, ids).catch((error) => reportSearchFailure(error, { op: "sync", ids }));
}

// Queues products whose stock, price, visibility, images or variants changed; call after commit, returns at once.
export function queueProductSync(ids: (string | null | undefined)[]): void {
  if (!meilisearchConfig()) {
    return;
  }
  for (const id of ids) {
    if (id) {
      pending.add(id);
    }
  }
  if (pending.size && !flushTimer) {
    flushTimer = setTimeout(flushQueue, SEARCH_SYNC_BATCH_MS);
  }
}

// A renamed category changes the documents of every product filed under it or under its children.
export async function queueCategorySync(categoryId: string): Promise<void> {
  if (!meilisearchConfig()) {
    return;
  }
  try {
    const categories = await loadCategories();
    const branch = new Set([categoryId]);
    for (let grew = true; grew;) {
      grew = false;
      for (const node of categories.values()) {
        if (node.parentId && branch.has(node.parentId) && !branch.has(node.id)) {
          branch.add(node.id);
          grew = true;
        }
      }
    }
    const products = await prisma.product.findMany({
      where: { categoryId: { in: [...branch] }, deletedAt: null },
      select: { id: true },
    });
    queueProductSync(products.map((p) => p.id));
  } catch (error) {
    reportSearchFailure(error, { op: "category-sync", categoryId });
  }
}

// An image or a variant belongs to a product one way or another; this finds it.
export async function queueOwnerSync(owner: { productId?: string | null; variantId?: string | null }): Promise<void> {
  if (owner.productId) {
    return queueProductSync([owner.productId]);
  }
  if (!owner.variantId || !meilisearchConfig()) {
    return;
  }
  try {
    const variant = await prisma.variant.findUnique({ where: { id: owner.variantId }, select: { productId: true } });
    queueProductSync([variant?.productId]);
  } catch (error) {
    reportSearchFailure(error, { op: "owner-sync", variantId: owner.variantId });
  }
}

// Applies the versioned index settings (constants/searchIndex.ts) to the live index.
export async function applySearchSettings(): Promise<{ engine: string; version: number }> {
  const config = meilisearchConfig();
  if (!config) {
    return { engine: SEARCH_ENGINES.POSTGRES, version: PRODUCTS_INDEX_VERSION };
  }
  await waitForTask(config, await meiliApplySettings(config, config.index));
  return { engine: SEARCH_ENGINES.MEILISEARCH, version: PRODUCTS_INDEX_VERSION };
}

// Builds a fresh index beside the live one and swaps it in, so search keeps answering and stale entries vanish.
export async function reindexAllProducts(): Promise<ReindexSummary> {
  const config = meilisearchConfig();
  if (!config) {
    return { engine: SEARCH_ENGINES.POSTGRES, indexed: 0 };
  }

  const staging = `${config.index}${REINDEX_SUFFIX}`;
  const startedAt = new Date();
  const categories = await loadCategories();
  await meiliDeleteIndex(config, staging);
  await waitForTask(config, await meiliApplySettings(config, staging));
  await waitForTask(config, await meiliApplySettings(config, config.index));

  let indexed = 0;
  let cursor: string | undefined;
  for (;;) {
    const rows: SearchProductRow[] = await prisma.product.findMany({
      where: { deletedAt: null },
      include: SEARCH_PRODUCT_INCLUDE,
      orderBy: { id: "asc" },
      take: REINDEX_BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!rows.length) {
      break;
    }
    await waitForTask(
      config,
      await meiliUpsert(
        config,
        staging,
        rows.map((r) => toSearchDocument(r, categories)),
      ),
    );
    indexed += rows.length;
    cursor = rows[rows.length - 1].id;
  }

  await waitForTask(config, await meiliSwapIndexes(config, config.index, staging));
  await meiliDeleteIndex(config, staging);
  // Saves made while the copy was being built went to the index that was just swapped out.
  const touched = await prisma.product.findMany({ where: { updatedAt: { gte: startedAt } }, select: { id: true } });
  if (touched.length) {
    await syncProducts(
      config,
      touched.map((p) => p.id),
    );
  }
  return { engine: SEARCH_ENGINES.MEILISEARCH, indexed };
}

export async function searchEngineStatus(): Promise<SearchEngineStatus> {
  const config = meilisearchConfig();
  if (!config) {
    return { engine: SEARCH_ENGINES.POSTGRES, reachable: true };
  }
  return { engine: SEARCH_ENGINES.MEILISEARCH, reachable: await meiliHealthy(config) };
}

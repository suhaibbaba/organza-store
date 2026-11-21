import type { Prisma } from "@prisma/client";
import { MAIN_IMAGE_ONLY } from "@/constants/images";

export const SEARCH_ENGINES = { MEILISEARCH: "meilisearch", POSTGRES: "postgres" } as const;

export const SEARCH_ENV = {
  HOST: "MEILI_HOST",
  API_KEY: "MEILI_MASTER_KEY",
  INDEX: "MEILI_PRODUCT_INDEX",
} as const;

export const DEFAULT_PRODUCT_INDEX = "products";
export const REINDEX_SUFFIX = "_reindex";
export const SEARCH_PRIMARY_KEY = "id";

// Ranked ids a search hands back; the routes then filter and paginate them (matches maxTotalHits).
export const SEARCH_RESULT_LIMIT = 1_000;
export const SEARCH_REQUEST_TIMEOUT_MS = 1_500;
export const SEARCH_WRITE_TIMEOUT_MS = 10_000;
export const SEARCH_HEALTH_TIMEOUT_MS = 1_000;
// One report a minute while the engine is down, not one per keystroke.
export const SEARCH_ERROR_REPORT_INTERVAL_MS = 60_000;

export const REINDEX_BATCH_SIZE = 1_000;
export const TASK_POLL_INTERVAL_MS = 250;
export const TASK_WAIT_TIMEOUT_MS = 120_000;
// A save waits this long for its product to become searchable, then returns anyway.
export const INDEX_SYNC_WAIT_MS = 2_000;
// Stock and visibility changes are collected for this long and sent as one batch.
export const SEARCH_SYNC_BATCH_MS = 500;
export const TASK_DONE_STATUSES = ["succeeded", "failed", "canceled"] as const;

// Products matching fewer of the words still come back, ranked below those matching all of them.
export const MATCHING_STRATEGY = "last";
// A code (ORG-00042, a barcode) is one token with a digit: every part must match, or "org" alone finds every SKU.
export const CODE_QUERY_PATTERN = /^\S*\d\S*$/;
export const CODE_MATCHING_STRATEGY = "all";
export const ACTIVE_ONLY_FILTER = "isActive = true";

// With a search term and the list's default sort, results come back closest match first.
export const RELEVANCE_DEFAULT_SORT = {
  PRODUCTS: { sortBy: "createdAt", sortDir: "desc" },
  INVENTORY: { sortBy: "stock", sortDir: "asc" },
} as const;

// pg_trgm fallback: word_similarity above this, or a plain substring match.
export const TRIGRAM_WORD_SIMILARITY_THRESHOLD = 0.35;

export const ARABIC_DEFINITE_ARTICLE = "ال";
// Shorter words starting with ال are usually the root itself, not the article.
export const ARABIC_ARTICLE_MIN_WORD_LENGTH = 5;
// Attached "and / with / for" (وابيض، باللون، للبس), indexed without them too; never stripped from a query.
export const ARABIC_PROCLITICS = ["و", "ب", "ل"] as const;
export const ARABIC_PROCLITIC_MIN_WORD_LENGTH = 5;

// What a search document is built from.
export const SEARCH_PRODUCT_INCLUDE = {
  images: MAIN_IMAGE_ONLY,
  variants: {
    select: {
      name: true,
      sku: true,
      barcode: true,
      stock: true,
      values: { select: { optionValue: { select: { value: true } } } },
    },
  },
} satisfies Prisma.ProductInclude;

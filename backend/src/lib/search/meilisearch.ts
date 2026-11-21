import {
  ACTIVE_ONLY_FILTER,
  CODE_MATCHING_STRATEGY,
  CODE_QUERY_PATTERN,
  MATCHING_STRATEGY,
  SEARCH_HEALTH_TIMEOUT_MS,
  SEARCH_PRIMARY_KEY,
  SEARCH_REQUEST_TIMEOUT_MS,
  SEARCH_WRITE_TIMEOUT_MS,
  TASK_DONE_STATUSES,
  TASK_POLL_INTERVAL_MS,
  TASK_WAIT_TIMEOUT_MS,
} from "@/constants/search";
import { PRODUCT_SYNONYMS, PRODUCTS_INDEX_SETTINGS } from "@/constants/searchIndex";
import { normalize, normalizeQuery } from "@/lib/search/normalize";
import type {
  MeilisearchConfig,
  MeilisearchTask,
  MeilisearchTaskStatus,
  ProductSearchDocument,
  ProductSearchOptions,
} from "@/types/search";

// A thin REST client: the official SDK is ESM-only and this backend compiles to CommonJS.
async function request<T>(
  config: MeilisearchConfig,
  method: string,
  path: string,
  timeoutMs: number,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${config.host}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Meilisearch ${method} ${path} -> ${res.status} ${detail.slice(0, 300)}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

const indexPath = (index: string) => `/indexes/${encodeURIComponent(index)}`;

// Synonyms are matched after the query is normalized, so they are stored normalized too.
export function normalizedSynonyms(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [word, others] of Object.entries(PRODUCT_SYNONYMS)) {
    const key = normalize(word);
    out[key] = [...new Set([...(out[key] ?? []), ...others.map(normalize)])].filter((w) => w !== key);
  }
  return out;
}

export async function meiliSearchIds(
  config: MeilisearchConfig,
  query: string,
  limit: number,
  options: ProductSearchOptions = {},
): Promise<string[]> {
  const q = normalizeQuery(query);
  if (!q) {
    return [];
  }
  const result = await request<{ hits: { id: string }[] }>(
    config,
    "POST",
    `${indexPath(config.index)}/search`,
    SEARCH_REQUEST_TIMEOUT_MS,
    {
      q,
      limit,
      attributesToRetrieve: [SEARCH_PRIMARY_KEY],
      matchingStrategy: CODE_QUERY_PATTERN.test(q) ? CODE_MATCHING_STRATEGY : MATCHING_STRATEGY,
      ...(options.activeOnly ? { filter: ACTIVE_ONLY_FILTER } : {}),
    },
  );
  return result.hits.map((hit) => hit.id);
}

export function meiliUpsert(config: MeilisearchConfig, index: string, docs: ProductSearchDocument[]) {
  return request<MeilisearchTask>(
    config,
    "POST",
    `${indexPath(index)}/documents?primaryKey=${SEARCH_PRIMARY_KEY}`,
    SEARCH_WRITE_TIMEOUT_MS,
    docs,
  );
}

export function meiliDelete(config: MeilisearchConfig, index: string, ids: string[]) {
  return request<MeilisearchTask>(
    config,
    "POST",
    `${indexPath(index)}/documents/delete-batch`,
    SEARCH_WRITE_TIMEOUT_MS,
    ids,
  );
}

// Settings PATCH creates the index when it does not exist yet.
export function meiliApplySettings(config: MeilisearchConfig, index: string) {
  return request<MeilisearchTask>(config, "PATCH", `${indexPath(index)}/settings`, SEARCH_WRITE_TIMEOUT_MS, {
    ...PRODUCTS_INDEX_SETTINGS,
    synonyms: normalizedSynonyms(),
  });
}

export async function meiliDeleteIndex(config: MeilisearchConfig, index: string): Promise<void> {
  try {
    await waitForTask(
      config,
      await request<MeilisearchTask>(config, "DELETE", indexPath(index), SEARCH_WRITE_TIMEOUT_MS),
    );
  } catch (error) {
    if (!String(error).includes("index_not_found")) {
      throw error;
    }
  }
}

export function meiliSwapIndexes(config: MeilisearchConfig, a: string, b: string) {
  return request<MeilisearchTask>(config, "POST", "/swap-indexes", SEARCH_WRITE_TIMEOUT_MS, [{ indexes: [a, b] }]);
}

export async function waitForTask(
  config: MeilisearchConfig,
  task: MeilisearchTask,
  timeoutMs: number = TASK_WAIT_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await request<MeilisearchTaskStatus>(
      config,
      "GET",
      `/tasks/${task.taskUid}`,
      SEARCH_WRITE_TIMEOUT_MS,
    );
    if ((TASK_DONE_STATUSES as readonly string[]).includes(status.status)) {
      if (status.status !== "succeeded") {
        throw new Error(
          `Meilisearch task ${task.taskUid} ${status.status}: ${status.error?.code ?? ""} ${status.error?.message ?? ""}`,
        );
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, TASK_POLL_INTERVAL_MS));
  }
  throw new Error(`Meilisearch task ${task.taskUid} did not finish within ${timeoutMs}ms`);
}

export async function meiliHealthy(config: MeilisearchConfig): Promise<boolean> {
  try {
    const body = await request<{ status: string }>(config, "GET", "/health", SEARCH_HEALTH_TIMEOUT_MS);
    return body.status === "available";
  } catch {
    return false;
  }
}

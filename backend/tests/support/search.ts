import { apiRequest } from "@tests/support/client";
import { MAX_PAGE_SIZE } from "@store/shared/constants/pagination";
import { SEARCH_INDEX_POLL_MS, SEARCH_INDEX_WAIT_MS } from "@tests/constants";
import type { ProductSummaryDto } from "@tests/types";

// Searches until the result agrees with `expected` or the wait runs out, then returns the last answer.
export async function searchUntil(token: string, query: string, expected: (ids: string[]) => boolean) {
  const deadline = Date.now() + SEARCH_INDEX_WAIT_MS;
  for (;;) {
    const res = await apiRequest<ProductSummaryDto[]>(
      `/api/products?pageSize=${MAX_PAGE_SIZE}&q=${encodeURIComponent(query)}`,
      { token }
    );
    const ids = (res.data ?? []).map((p) => p.id);
    if (res.status !== 200 || expected(ids) || Date.now() > deadline) return { status: res.status, ids };
    await new Promise((resolve) => setTimeout(resolve, SEARCH_INDEX_POLL_MS));
  }
}

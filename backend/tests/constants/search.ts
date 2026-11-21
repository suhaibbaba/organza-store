// Meilisearch indexes a moment after the save, so a search test retries this long before failing.
export const SEARCH_INDEX_WAIT_MS = 5_000;
export const SEARCH_INDEX_POLL_MS = 200;

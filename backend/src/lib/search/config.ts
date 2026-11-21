import "dotenv/config";
import { DEFAULT_PRODUCT_INDEX, SEARCH_ENV } from "@/constants/search";
import type { MeilisearchConfig } from "@/types/search";

function trimmed(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

// Read at call time so a script or test can point it elsewhere; no host means the Postgres engine.
export function meilisearchConfig(): MeilisearchConfig | null {
  const host = trimmed(SEARCH_ENV.HOST);
  if (!host) {
    return null;
  }
  return {
    host: host.replace(/\/+$/, ""),
    apiKey: trimmed(SEARCH_ENV.API_KEY),
    index: trimmed(SEARCH_ENV.INDEX) ?? DEFAULT_PRODUCT_INDEX,
  };
}

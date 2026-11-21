"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { readUrlFilters, writeUrlFilters } from "@/lib/url-filters";
import type { FilterUpdate, UrlParams } from "@/types/urlFilters";

// A list's filters, sort, page and page size live in the query string, so a reload, a shared link or Back keeps them.
export function useUrlFilters<T extends object>(
  defaults: T,
  params: UrlParams<T>,
): [T, (update: FilterUpdate<T>) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = searchParams.toString();
  const filters = useMemo(
    () => readUrlFilters(new URLSearchParams(query), defaults, params),
    [query, defaults, params],
  );

  const update = useCallback(
    (change: FilterUpdate<T>) => {
      // Read the live URL, not this render's copy, so a debounced search cannot undo a change made meanwhile.
      const live = new URLSearchParams(window.location.search);
      const current = readUrlFilters(live, defaults, params);
      const next = { ...current, ...(typeof change === "function" ? change(current) : change) };
      const written = writeUrlFilters(live, next, defaults, params).toString();
      if (written === live.toString()) {
        return;
      }
      router.replace(written ? `${pathname}?${written}` : pathname, { scroll: false });
    },
    [defaults, params, pathname, router],
  );

  return [filters, update];
}

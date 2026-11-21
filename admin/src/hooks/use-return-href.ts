"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname } from "@/i18n/navigation";
import { RETURN_QUERIES_KEY } from "@/constants/storage";

const listeners = new Set<() => void>();
let cache: string | null = null;

function read(): string {
  if (cache === null) {
    try {
      cache = sessionStorage.getItem(RETURN_QUERIES_KEY) ?? "{}";
    } catch {
      cache = "{}";
    }
  }
  return cache;
}

function remember(pathname: string, query: string) {
  const map = JSON.parse(read()) as Record<string, string>;
  if ((map[pathname] ?? "") === query) {
    return;
  }
  if (query) {
    map[pathname] = query;
  } else {
    delete map[pathname];
  }
  cache = JSON.stringify(map);
  try {
    sessionStorage.setItem(RETURN_QUERIES_KEY, cache);
  } catch {
    // Private mode: the memory copy still serves this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Records every page's query string and turns a parent link into the list exactly as it was left (filters, page, search).
export function useReturnHref(): (href: string) => string {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const snapshot = useSyncExternalStore(subscribe, read, () => "{}");

  useEffect(() => {
    remember(pathname, query);
  }, [pathname, query]);

  return useCallback(
    (href: string) => {
      const saved = (JSON.parse(snapshot) as Record<string, string>)[href];
      return saved ? `${href}?${saved}` : href;
    },
    [snapshot],
  );
}

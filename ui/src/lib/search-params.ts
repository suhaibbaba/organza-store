"use client";

import { usePathname, useRouter, useSearchParams as useNextSearchParams } from "next/navigation";
import { useCallback } from "react";

type NextParams = URLSearchParams | ((current: URLSearchParams) => URLSearchParams);

interface SetOptions {
  readonly replace?: boolean;
}

// react-router's `useSearchParams()` — [params, setParams] — on Next's
// router, which is all the tabs and the table's paging ask of it. Writing
// replaces the history entry by default and never scrolls, so switching a tab
// does not jump the page.
export function useSearchParams(): [URLSearchParams, (next: NextParams, options?: SetOptions) => void] {
  const current = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const setParams = useCallback(
    (next: NextParams, options?: SetOptions) => {
      const base = new URLSearchParams(current?.toString() ?? "");
      const resolved = typeof next === "function" ? next(base) : next;
      const query = resolved.toString();
      const url = query ? `${pathname}?${query}` : pathname;

      if (options?.replace === false) {
        router.push(url, { scroll: false });
      } else {
        router.replace(url, { scroll: false });
      }
    },
    [current, pathname, router],
  );

  return [new URLSearchParams(current?.toString() ?? ""), setParams];
}

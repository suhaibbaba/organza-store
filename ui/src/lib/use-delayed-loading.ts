import { useEffect, useRef, useState } from "react";

export const SKELETON_DELAY_MS = 150;
export const SKELETON_MIN_VISIBLE_MS = 300;

export interface QueryLoadingState {
  readonly showSkeleton: boolean;
  readonly isRefreshing: boolean;
}

interface QueryLike {
  readonly isPending: boolean;
  readonly isFetching: boolean;
}

export function useDelayedLoading(isLoading: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (isLoading === visible) {
      return;
    }

    if (isLoading) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, SKELETON_DELAY_MS);

      return () => clearTimeout(timer);
    }

    const remaining = SKELETON_MIN_VISIBLE_MS - (Date.now() - shownAt.current);
    const timer = setTimeout(() => setVisible(false), Math.max(remaining, 0));

    return () => clearTimeout(timer);
  }, [isLoading, visible]);

  return visible;
}

export const isRefetching = (query: QueryLike): boolean => query.isFetching && !query.isPending;

export function useQueryLoading(query: QueryLike): QueryLoadingState {
  return { showSkeleton: useDelayedLoading(query.isPending), isRefreshing: isRefetching(query) };
}

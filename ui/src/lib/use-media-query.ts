import { useSyncExternalStore } from "react";

export const MD_BREAKPOINT = 768;
export const RAIL_BREAKPOINT = 1025;

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => undefined;
      }

      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  );
}

export const useIsMobile = (): boolean => useMediaQuery(`(max-width: ${MD_BREAKPOINT - 1}px)`);

export const useIsCompactLayout = (): boolean =>
  useMediaQuery(`not all and (min-width: ${RAIL_BREAKPOINT}px)`);

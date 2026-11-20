import { useSyncExternalStore } from "react";

// Whether a media query matches, kept live as the window is resized. For the
// few things CSS cannot switch by itself; everything else is a class.
// False on the server and on first paint, so a phone never flashes the wide
// variant.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

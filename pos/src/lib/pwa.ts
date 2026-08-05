/** Running from the Home Screen rather than in a browser tab. */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  // iOS predates display-mode and reports it its own way.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

// The two conditions the app's own pull-to-refresh needs: installed (a tab
// still has the browser's own gesture, and two would fight) and a finger to
// pull with. Shaped for useSyncExternalStore — read from the browser rather
// than mirrored into state, so it can't go stale and there is nothing to set
// in an effect. Both media queries are watched, since an installed app can
// be opened on a device that gains a mouse (a tablet with a keyboard case).

const STANDALONE_QUERY = "(display-mode: standalone)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";

export function subscribeToInstalledTouchApp(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const queries = [window.matchMedia(STANDALONE_QUERY), window.matchMedia(COARSE_POINTER_QUERY)];
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}

export function isInstalledTouchApp(): boolean {
  if (typeof window === "undefined") return false;
  return isInstalledApp() && window.matchMedia(COARSE_POINTER_QUERY).matches;
}

/** Server render: assume not installed, so the markup matches first paint. */
export const isInstalledTouchAppOnServer = (): boolean => false;

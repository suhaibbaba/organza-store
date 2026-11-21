/** Running from the Home Screen rather than in a browser tab. */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  // iOS predates display-mode and reports it its own way.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

// Installed (a tab has the browser's gesture) and touch; read live, since a tablet can gain a mouse.

const STANDALONE_QUERY = "(display-mode: standalone)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";

export function subscribeToInstalledTouchApp(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const queries = [window.matchMedia(STANDALONE_QUERY), window.matchMedia(COARSE_POINTER_QUERY)];
  for (const query of queries) {
    query.addEventListener("change", onChange);
  }
  return () => {
    for (const query of queries) {
      query.removeEventListener("change", onChange);
    }
  };
}

export function isInstalledTouchApp(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return isInstalledApp() && window.matchMedia(COARSE_POINTER_QUERY).matches;
}

/** Server render: assume not installed, so the markup matches first paint. */
export const isInstalledTouchAppOnServer = (): boolean => false;

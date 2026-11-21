import { coordinatesFromMapLink, isGoogleMapsLink, roundCoordinate } from "@organza/shared/lib/mapLink";
import { MAP_LINK_MAX_REDIRECTS, MAP_LINK_TIMEOUT_MS } from "@organza/shared/constants/mapLink";
import type { Coordinates } from "@organza/shared/types/order";

// Follows a Google short link hop by hop, refusing any hop that leaves Google's map hosts; null when no point is found.
export async function resolveMapLink(link: string): Promise<Coordinates | null> {
  let current = link;
  for (let hop = 0; hop <= MAP_LINK_MAX_REDIRECTS; hop += 1) {
    const point = coordinatesFromMapLink(current);
    if (point) return { latitude: roundCoordinate(point.latitude), longitude: roundCoordinate(point.longitude) };
    if (!isGoogleMapsLink(current)) return null;

    let next: string | null;
    try {
      const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(MAP_LINK_TIMEOUT_MS) });
      next = response.headers.get("location");
    } catch {
      return null;
    }
    if (!next) return null;
    current = new URL(next, current).toString();
  }
  return null;
}

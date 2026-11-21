import {
  GOOGLE_HOST_PATTERN,
  GOOGLE_MAPS_PATH_PREFIX,
  GOOGLE_MAPS_SEARCH_URL,
  GOOGLE_MAPS_SHORT_LINK_HOSTS,
  MAP_LINK_COORDINATE_DIGITS,
  MAP_LINK_COORDINATE_PATTERNS,
} from "@/constants/mapLink";
import { LATITUDE_MAX, LATITUDE_MIN, LONGITUDE_MAX, LONGITUDE_MIN } from "@/constants/order";
import type { Coordinates } from "@/types/order";

function toUrl(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function inRange({ latitude, longitude }: Coordinates): boolean {
  return latitude >= LATITUDE_MIN && latitude <= LATITUDE_MAX && longitude >= LONGITUDE_MIN && longitude <= LONGITUDE_MAX;
}

// Reads the point out of a Google Maps link, or a bare "32.31, 35.02" pair; null when the text holds none.
export function coordinatesFromMapLink(value: string): Coordinates | null {
  const text = safeDecode(value.trim());
  for (const pattern of MAP_LINK_COORDINATE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const point = { latitude: Number(match[1]), longitude: Number(match[2]) };
    if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && inRange(point)) return point;
  }
  return null;
}

export function isShortMapLink(value: string): boolean {
  const url = toUrl(value);
  return !!url && url.protocol === "https:" && (GOOGLE_MAPS_SHORT_LINK_HOSTS as readonly string[]).includes(url.hostname);
}

// Only Google's map pages and short links are ever fetched, so a pasted link can't point the server elsewhere.
export function isGoogleMapsLink(value: string): boolean {
  const url = toUrl(value);
  if (!url || url.protocol !== "https:") return false;
  if ((GOOGLE_MAPS_SHORT_LINK_HOSTS as readonly string[]).includes(url.hostname)) return true;
  if (!GOOGLE_HOST_PATTERN.test(url.hostname)) return false;
  return url.hostname.startsWith("maps.") || url.pathname.startsWith(GOOGLE_MAPS_PATH_PREFIX);
}

export function roundCoordinate(value: number): number {
  return Number(value.toFixed(MAP_LINK_COORDINATE_DIGITS));
}

export function googleMapsUrl({ latitude, longitude }: Coordinates): string {
  return `${GOOGLE_MAPS_SEARCH_URL}${latitude},${longitude}`;
}

// Google's own short-link hosts; every other Maps link is a google.<tld>/maps or maps.google.<tld> page.
export const GOOGLE_MAPS_SHORT_LINK_HOSTS = ["maps.app.goo.gl", "goo.gl"] as const;
export const GOOGLE_HOST_PATTERN = /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;
export const GOOGLE_MAPS_PATH_PREFIX = "/maps";
export const GOOGLE_MAPS_SEARCH_URL = "https://www.google.com/maps/search/?api=1&query=";

// A short link lands after one or two hops; the cap and timeout keep a bad link from holding the request.
export const MAP_LINK_MAX_REDIRECTS = 5;
export const MAP_LINK_TIMEOUT_MS = 5000;
export const MAP_LINK_MAX_LENGTH = 2048;
export const MAP_LINK_COORDINATE_DIGITS = 6;

const NUMBER = "(-?\\d{1,3}(?:\\.\\d+)?)";
// Most precise first: a dropped pin, then an explicit query, then the map's centre.
export const MAP_LINK_COORDINATE_PATTERNS: readonly RegExp[] = [
  new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
  new RegExp(`[?&](?:q|query|ll|destination|daddr|center)=(?:loc:)?${NUMBER}\\s*,\\s*${NUMBER}`),
  new RegExp(`/(?:place|search|dir)/${NUMBER}\\s*,\\s*\\+?${NUMBER}`),
  new RegExp(`@${NUMBER},${NUMBER}`),
  new RegExp(`^\\s*${NUMBER}\\s*,\\s*${NUMBER}\\s*$`),
];

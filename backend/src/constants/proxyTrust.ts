// What sits in front of the API, and how the app is told about it.
// The reasoning lives in lib/proxyTrust.ts; these are the strings.

/** The one NODE_ENV value that means "somebody is running this by hand". */
export const DEVELOPMENT_NODE_ENV = "development";

/**
 * The hop count for the CURRENT deployment: Cloudflare -> nginx -> API.
 *
 * Two, and worth spelling out because it changed and nothing said so. It was
 * one while nginx was the only thing in front of the API; putting Cloudflare
 * in front added a hop, and a value that is one too small hands express the
 * PROXY's address instead of the caller's — silently, on every request.
 *
 * Counted the way express counts: `X-Forwarded-For` arrives as
 * `<caller>, <cloudflare>` (Cloudflare appends the caller, nginx appends
 * Cloudflare with the usual `$proxy_add_x_forwarded_for`), express walks back
 * from the socket through that many trusted hops, and what is left is the
 * caller. If the chain in front of this API ever changes, this number and
 * TRUSTED_PROXY_IPS change together.
 *
 * Documentation, not a default: it is quoted in the warning below and in
 * .env.example. Nothing reads it as a fallback, because guessing a hop count
 * for a deployment this file cannot see is how the wrong one gets trusted.
 */
export const CURRENT_DEPLOYMENT_PROXY_HOPS = 2;

/**
 * Printed on every start of a deployed build that has been told nothing.
 *
 * Written as instructions rather than as a complaint because the person
 * reading it is looking at a deploy log, probably at speed, and needs to know
 * what to type — and because the failure it describes has no other symptom
 * until the morning nobody can sign in.
 */
export const PROXY_TRUST_HINT = [
  "  ⚠️  PROXY TRUST IS INCOMPLETE, and this is a deployed build.",
  "",
  "  Callers therefore look like the reverse proxy rather than like themselves, so a",
  "  per-caller rate limit becomes one shared bucket for the whole internet — sign-in,",
  "  password reset, link redemption. One machine can spend it and lock the shop out of",
  "  the till, from every network, for as long as it keeps going.",
  "",
  "  BOTH of these are needed. They describe the same chain to two different readers, and",
  "  setting only one leaves the other half counting the proxy:",
  "",
  `      TRUST_PROXY=${CURRENT_DEPLOYMENT_PROXY_HOPS}                       # hop count, read by express`,
  "      TRUSTED_PROXY_IPS=<nginx>,<Cloudflare ranges>   # IPs/CIDRs, read by Better Auth",
  "",
  "  The hop count above is for the current Cloudflare -> nginx -> API chain.",
  "  See backend/.env.example for the full explanation of both.",
] as const;

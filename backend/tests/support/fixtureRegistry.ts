// What this run has created, so it can be taken away again.
//
// A leaf module on purpose: it imports nothing, which is what lets
// tests/support/client.ts feed it from inside every request without a cycle
// (client -> registry, cleanup -> client + registry).
//
// Registration is AUTOMATIC. Rather than asking every test to remember,
// apiRequest reports each successful create back here — so a fixture is
// tracked whether it was made by a helper, by a verify test or by one of the
// older API suites, and "self-cleaning" is not a discipline anybody has to
// keep.
import type { FixtureKind, FixtureRecord } from "@tests/types";

// Paths whose successful POST creates something that has to be cleaned up.
// Matched EXACTLY against the path with its query string removed, so
// /api/orders is tracked while /api/orders/collect and
// /api/products/labels/printed are not.
const CREATE_ROUTES: Readonly<Record<string, FixtureKind>> = {
  "/api/products": "product",
  "/api/orders": "order",
  "/api/expenses": "expense",
};

const records: FixtureRecord[] = [];
const seen = new Set<string>();

function remember(kind: FixtureKind, id: string): void {
  const key = `${kind}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  records.push({ kind, id });
}

export function registerFixture(kind: FixtureKind, id: string): void {
  if (typeof id === "string" && id.length > 0) remember(kind, id);
}

// When this process started. A change request older than that was not asked
// for by this run — it belongs to the seed, or to the shop — so it is left
// exactly where it is. Without this, merely READING a product that already
// had something waiting on it would enrol somebody else's request for
// rejection at teardown.
const RUN_STARTED_AT = Date.now();

function askedForByThisRun(entry: { requestedAt?: unknown }): boolean {
  const requestedAt = typeof entry.requestedAt === "string" ? Date.parse(entry.requestedAt) : NaN;
  // An entry with no usable timestamp is treated as somebody else's: the cost
  // of leaving one behind is a stale row, the cost of guessing wrong is
  // rejecting a request the shop was waiting on.
  return Number.isFinite(requestedAt) && requestedAt >= RUN_STARTED_AT;
}

/**
 * Anything still waiting for an Admin that this run asked for.
 *
 * A gated Employee edit answers with the request it filed rather than
 * applying (spec.md "Employee change approvals"), so these arrive on ordinary
 * PATCH responses rather than on a create — and left behind they would sit in
 * the shop's approval list and on its navigation badge.
 */
function harvestChangeRequests(value: unknown, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const entry of value) harvestChangeRequests(entry, depth + 1);
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["pendingChange", "pendingChanges"]) {
    const held = record[key];
    for (const entry of Array.isArray(held) ? held : [held]) {
      const change = entry as { id?: unknown; requestedAt?: unknown } | null | undefined;
      if (change && typeof change.id === "string" && askedForByThisRun(change)) {
        remember("changeRequest", change.id);
      }
    }
  }

  // Nested one level down as well: a product carries its own pendingChanges,
  // and a change request's approval response carries the entity it touched.
  for (const nested of Object.values(record)) harvestChangeRequests(nested, depth + 1);
}

/** Called by apiRequest for every response — the only entry point that matters. */
export function noteResponse(path: string, method: string, status: number, body: unknown): void {
  const route = path.split("?")[0];
  const kind = CREATE_ROUTES[route];
  const data = (body as { data?: { id?: unknown } } | null | undefined)?.data;

  if (kind && method === "POST" && status === 201 && typeof data?.id === "string") {
    remember(kind, data.id);
  }

  harvestChangeRequests(data);
}

/** Everything tracked so far, newest first — the order teardown wants. */
export function takeFixtures(): FixtureRecord[] {
  const taken = records.slice().reverse();
  records.length = 0;
  seen.clear();
  return taken;
}

export function fixtureCount(): number {
  return records.length;
}

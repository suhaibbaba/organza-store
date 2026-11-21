// A leaf module (imports nothing) so client.ts can feed it from every request without a cycle.
import type { FixtureKind, FixtureRecord } from "@tests/types";

// Matched exactly, query string removed: /api/orders is tracked, /api/orders/collect is not.
const CREATE_ROUTES: Readonly<Record<string, FixtureKind>> = {
  "/api/products": "product",
  "/api/orders": "order",
  "/api/expenses": "expense",
};

const records: FixtureRecord[] = [];
const seen = new Set<string>();

function remember(kind: FixtureKind, id: string): void {
  const key = `${kind}:${id}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  records.push({ kind, id });
}

export function registerFixture(kind: FixtureKind, id: string): void {
  if (typeof id === "string" && id.length > 0) {
    remember(kind, id);
  }
}

// A request older than this run is the shop's or the seed's, and is never rejected at teardown.
const RUN_STARTED_AT = Date.now();

function askedForByThisRun(entry: { requestedAt?: unknown }): boolean {
  const requestedAt = typeof entry.requestedAt === "string" ? Date.parse(entry.requestedAt) : NaN;
  // No usable timestamp means somebody else's: a stale row beats rejecting a request the shop was waiting on.
  return Number.isFinite(requestedAt) && requestedAt >= RUN_STARTED_AT;
}

/** Requests this run filed: gated edits answer with them on ordinary PATCH responses. */
function harvestChangeRequests(value: unknown, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      harvestChangeRequests(entry, depth + 1);
    }
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

  // One level down too: a product carries pendingChanges, an approval carries its entity.
  for (const nested of Object.values(record)) {
    harvestChangeRequests(nested, depth + 1);
  }
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

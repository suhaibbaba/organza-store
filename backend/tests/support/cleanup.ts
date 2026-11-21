// Runs after every file and never throws; undoes in reverse order (requests, orders, expenses, products), all soft deletes (rule 4).
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { takeFixtures } from "@tests/support/fixtureRegistry";
import { keepFixtures } from "@tests/support/target";
import { FIXTURE_KINDS } from "@tests/types";
import type { CleanupOutcome, FixtureKind, FixtureRecord } from "@tests/types";

// Already gone is a clean outcome: the test may have deleted it itself.
const ALREADY_GONE = [404, 409];

async function removeOne(
  token: string,
  fixture: FixtureRecord,
): Promise<{ ok: boolean; status: number; code?: string }> {
  const { kind, id } = fixture;

  const res =
    kind === "changeRequest"
      ? await apiRequest(`/api/change-requests/${id}/reject`, {
          method: "POST",
          token,
          body: { note: "verification suite teardown" },
        })
      : await apiRequest(`/api/${kind === "order" ? "orders" : kind === "expense" ? "expenses" : "products"}/${id}`, {
          method: "DELETE",
          token,
        });

  return { ok: res.status >= 200 && res.status < 300, status: res.status, code: res.error?.code };
}

/** Drains the registry; safe when empty and when repeated, so a re-run leaves the target as found. */
export async function drainFixtures(): Promise<CleanupOutcome> {
  const outcome: CleanupOutcome = { removed: 0, skipped: 0, failures: [] };
  const fixtures = takeFixtures();
  if (fixtures.length === 0 || keepFixtures()) {
    return outcome;
  }

  let token: string;
  try {
    token = (await getSession("ADMIN")).token;
  } catch (error) {
    outcome.failures.push({ kind: "product", id: "*", reason: `no Admin session: ${String(error)}` });
    return outcome;
  }

  // Grouped by kind so the teardown order holds whatever order tests created things in.
  const byKind = new Map<FixtureKind, FixtureRecord[]>();
  for (const fixture of fixtures) {
    const bucket = byKind.get(fixture.kind);
    if (bucket) {
      bucket.push(fixture);
    } else {
      byKind.set(fixture.kind, [fixture]);
    }
  }

  for (const kind of FIXTURE_KINDS) {
    for (const fixture of byKind.get(kind) ?? []) {
      try {
        const result = await removeOne(token, fixture);
        if (result.ok) {
          outcome.removed += 1;
        } else if (ALREADY_GONE.includes(result.status)) {
          outcome.skipped += 1;
        } else {
          outcome.failures.push({ kind, id: fixture.id, reason: `HTTP ${result.status} ${result.code ?? ""}`.trim() });
        }
      } catch (error) {
        outcome.failures.push({ kind, id: fixture.id, reason: String(error) });
      }
    }
  }

  return outcome;
}

/** Reports a teardown that could not finish, without failing the run over it. */
export function warnAboutLeftovers(outcome: CleanupOutcome): void {
  if (outcome.failures.length === 0) {
    return;
  }
  const lines = outcome.failures.map((failure) => `   • ${failure.kind} ${failure.id}: ${failure.reason}`);
  console.warn(
    ["", "⚠️  Some test fixtures could not be cleaned up and are still on the target:", ...lines, ""].join("\n"),
  );
}

// Global setup (wired via vitest.config.ts's `setupFiles`), so it runs
// ahead of every test file's own tests.
import { afterAll, beforeAll } from "vitest";
import { Role } from "@prisma/client";
import { getSession } from "@tests/support/auth";
import { assertSafeTarget } from "@tests/support/target";
import { drainFixtures, warnAboutLeftovers } from "@tests/support/cleanup";
import { applyDefaultPermissions } from "@tests/support/permissions";
import { SEEDED_ACCOUNTS } from "@tests/constants";
import type { SeededRole } from "@tests/types";

// THE SAFETY GATE, before anything else in the file — including the imports'
// own side effects, which is why it is a bare statement rather than a hook.
//
// The suite is not read-only: it creates orders, moves stock, records
// expenses and opens cash drawers. So the target is classified first, the
// sandbox is the default, and the live shop (or any host this suite does not
// recognise) is refused outright unless the run says otherwise in full —
// see tests/support/target.ts and tests/constants/targets.ts.
assertSafeTarget();

// Fails fast with a clear, actionable message instead of a cryptic
// "Cannot read properties of undefined (reading 'EMPLOYEE')" deep inside a
// test — Role is a value the generated Prisma client adds to
// @prisma/client, which only exists after `prisma generate` has run.
// backend/package.json's "postinstall" script does this on every install,
// but this guard catches the case where that got skipped (e.g. vitest
// invoked directly against stale node_modules).
if (!Role || typeof Role.ADMIN !== "string" || typeof Role.MANAGER !== "string" || typeof Role.EMPLOYEE !== "string") {
  throw new Error(
    "@prisma/client's Role enum is undefined or incomplete — the Prisma client hasn't been generated. " +
      "Run `npx prisma generate` (or `npm run prisma:generate`) before running the API test suite."
  );
}

// Logs in all three seeded accounts once, serially, before any test file's
// tests run. getSession() caches each role's session in a module-level Map
// (tests/support/auth.ts); vitest.config.ts's isolate:false + singleFork
// makes that Map a true process-wide singleton, so this beforeAll — even
// though it's registered per test file — only performs the actual sign-in
// HTTP calls once for the whole run. Every other file's copy of this same
// beforeAll just awaits the already-resolved cached session.
beforeAll(async () => {
  for (const role of Object.keys(SEEDED_ACCOUNTS) as SeededRole[]) {
    await getSession(role);
  }

  // ...and then STATES the permission rules the whole suite is written
  // against, rather than hoping the target still has them.
  //
  // Which actions a role holds is configurable per shop now (spec.md
  // "Editable role permissions"), so "an Employee cannot delete a product"
  // is no longer a fact about the code — it is a row in the target's
  // database, which somebody may have changed from the admin this morning.
  // A suite that assumed the shipped defaults would report that change as a
  // failure of the code, which is exactly the wrong end of the telescope.
  //
  // So the baseline is written first, once, for the whole run. Individual
  // cases that need a grant flipped do it explicitly and put it back
  // (tests/support/permissions.ts, `withRolePermission`).
  //
  // Like the sign-ins above, this is registered per test file but performs
  // its work once: the module-level flag in applyDefaultPermissionsOnce is a
  // process-wide singleton thanks to vitest.config.ts's isolate:false.
  await applyDefaultPermissionsOnce();
});

// ...and takes back everything the file created once it is done: orders,
// expenses, products, and anything left waiting for an Admin's approval.
// Registered here rather than per file so it covers every suite, including
// the ones written before there was a registry to feed
// (tests/support/fixtureRegistry.ts records fixtures from inside apiRequest).
//
// Deliberately never throws: a teardown failure must not mask the assertion
// that actually matters, so leftovers are reported loudly and the run's own
// verdict stands.
afterAll(async () => {
  warnAboutLeftovers(await drainFixtures());
});

// The permission baseline, written at most once per run however many test
// files register the hook above.
let permissionBaseline: Promise<void> | null = null;

function applyDefaultPermissionsOnce(): Promise<void> {
  permissionBaseline ??= applyDefaultPermissions();
  return permissionBaseline;
}

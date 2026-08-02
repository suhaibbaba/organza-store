// Global setup (wired via vitest.config.ts's `setupFiles`), so it runs
// ahead of every test file's own tests.
import { beforeAll } from "vitest";
import { Role } from "@prisma/client";
import { getSession } from "@tests/support/auth";
import { SEEDED_ACCOUNTS } from "@tests/constants";
import type { SeededRole } from "@tests/types";

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
});

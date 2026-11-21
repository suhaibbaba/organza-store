import { afterAll, beforeAll } from "vitest";
import { Role } from "@prisma/client";
import { getSession } from "@tests/support/auth";
import { assertSafeTarget } from "@tests/support/target";
import { drainFixtures, warnAboutLeftovers } from "@tests/support/cleanup";
import { applyDefaultPermissions } from "@tests/support/permissions";
import { SEEDED_ACCOUNTS } from "@tests/constants";
import type { SeededRole } from "@tests/types";

// The safety gate, before anything else: the suite writes real data, so an unrecognised target is refused.
assertSafeTarget();

// Fails fast if `prisma generate` was skipped, instead of a cryptic error deep inside a test.
if (!Role || typeof Role.ADMIN !== "string" || typeof Role.MANAGER !== "string" || typeof Role.EMPLOYEE !== "string") {
  throw new Error(
    "@prisma/client's Role enum is undefined or incomplete — the Prisma client hasn't been generated. " +
      "Run `npx prisma generate` (or `npm run prisma:generate`) before running the API test suite.",
  );
}

// Signs the three seeded accounts in once for the whole run: isolate:false + singleFork make the cache process-wide.
beforeAll(async () => {
  for (const role of Object.keys(SEEDED_ACCOUNTS) as SeededRole[]) {
    await getSession(role);
  }

  // Permissions are configurable per shop, so the suite writes the shipped baseline once instead of assuming it.
  await applyDefaultPermissionsOnce();
});

// Takes back every fixture the run created; never throws, so a teardown failure cannot mask a real result.
afterAll(async () => {
  warnAboutLeftovers(await drainFixtures());
});

// The permission baseline, written at most once per run.
let permissionBaseline: Promise<void> | null = null;

function applyDefaultPermissionsOnce(): Promise<void> {
  permissionBaseline ??= applyDefaultPermissions();
  return permissionBaseline;
}

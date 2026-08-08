import { describe, expect, it } from "vitest";
import { createInitialStaff, InitRefusedError } from "@/lib/init";
import { INIT_STAFF_ACCOUNTS } from "@/constants/init";
import type { InitAccountDetails, InitDependencies } from "@/types/init";

// The go-live command, without a database, a mail provider or a terminal.
// scripts/init.ts is the wiring; the rule is here, and this is where it is
// proven — including the refusal, which is the whole reason the command is
// safe to leave in the repo.

const ACCOUNTS: InitAccountDetails[] = [
  { email: "one@example.com", name: "One", phone: "+970599000101", role: "ADMIN" },
  { email: "two@example.com", name: "Two", phone: "+970599000102", role: "MANAGER" },
];

function recordingDeps(existingUsers: number): InitDependencies & {
  created: InitAccountDetails[];
  invited: string[];
} {
  const created: InitAccountDetails[] = [];
  const invited: string[] = [];
  return {
    created,
    invited,
    countUsers: async () => existingUsers,
    async createAccount(details) {
      created.push(details);
      return { id: `id-${created.length}`, name: details.name, email: details.email };
    },
    async sendInvite(user) {
      invited.push(user.email);
      return { expiresAt: new Date("2026-08-11T09:00:00.000Z") };
    },
  };
}

describe("init — the go-live staff command", () => {
  describe("the accounts it is for", () => {
    it("is the four agreed addresses, with their agreed roles", () => {
      // Hard-coded on purpose (constants/init.ts): this command IS those four
      // accounts. If somebody edits the table, that should be a deliberate
      // change to a test, not a quiet one to a live shop.
      expect(INIT_STAFF_ACCOUNTS.map((a) => [a.email, a.role])).toEqual([
        ["rawandabdelhadi@gmail.com", "ADMIN"],
        ["abumajd99.nn@gmail.com", "ADMIN"],
        ["shahdmeflh@gmail.com", "MANAGER"],
        ["jannah2642009@icloud.com", "MANAGER"],
      ]);
    });

    it("names no passwords anywhere", () => {
      // Every account is created with none, so there is nothing in the table
      // that could be one.
      expect(JSON.stringify(INIT_STAFF_ACCOUNTS)).not.toMatch(/password/i);
    });
  });

  describe("refusing a database that is already in use", () => {
    it("refuses when even one user exists", async () => {
      const deps = recordingDeps(1);
      await expect(createInitialStaff(ACCOUNTS, deps)).rejects.toBeInstanceOf(InitRefusedError);
    });

    it("writes nothing at all when it refuses", async () => {
      const deps = recordingDeps(7);
      await createInitialStaff(ACCOUNTS, deps).catch(() => undefined);
      // Not "creates some and stops" — a half-run init against a live shop
      // would be worse than no init at all.
      expect(deps.created).toEqual([]);
      expect(deps.invited).toEqual([]);
    });

    it("says how many accounts were in the way", async () => {
      const deps = recordingDeps(3);
      await expect(createInitialStaff(ACCOUNTS, deps)).rejects.toMatchObject({ existingUsers: 3 });
    });
  });

  describe("on an empty database", () => {
    it("creates every account, in order, and emails each one a link", async () => {
      const deps = recordingDeps(0);
      const results = await createInitialStaff(ACCOUNTS, deps);

      expect(deps.created).toEqual(ACCOUNTS);
      expect(deps.invited).toEqual(ACCOUNTS.map((a) => a.email));
      expect(results.map((r) => [r.email, r.role])).toEqual(ACCOUNTS.map((a) => [a.email, a.role]));
    });

    it("reports when each link stops working", async () => {
      const results = await createInitialStaff(ACCOUNTS, recordingDeps(0));
      for (const result of results) expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });
});

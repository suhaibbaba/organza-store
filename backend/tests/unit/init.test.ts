import { describe, expect, it } from "vitest";
import { createInitialStaff, InitRefusedError } from "@/lib/init";
import type { InitAccountDetails, InitDependencies } from "@/types/init";

// The go-live rule, proven without a database, mail provider or terminal — the refusal included.

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
  describe("refusing a database that is already in use", () => {
    it("refuses when even one user exists", async () => {
      const deps = recordingDeps(1);
      await expect(createInitialStaff(ACCOUNTS, deps)).rejects.toBeInstanceOf(InitRefusedError);
    });

    it("writes nothing at all when it refuses", async () => {
      const deps = recordingDeps(7);
      await createInitialStaff(ACCOUNTS, deps).catch(() => undefined);
      // All or nothing: a half-run init on a live shop is worse than none.
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
      for (const result of results) {
        expect(result.expiresAt).toBeInstanceOf(Date);
      }
    });
  });
});

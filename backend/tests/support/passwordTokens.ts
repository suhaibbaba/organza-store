import type { PasswordTokenStore, StoredPasswordToken } from "@/types/passwordSetup";

// An in-memory PasswordTokenStore plus a clock you can wind forward.
//
// This is what lets the token rules be PROVEN rather than assumed: expiry can
// be tested without waiting three days, and the single-use guarantee can be
// tested by racing two redemptions at each other — neither of which is
// reachable through the HTTP API, which only ever hands out a live token with
// a real expiry.
//
// It implements the same contract the Prisma store does
// (lib/passwordTokenStore.ts), including the one subtle part: markUsed is
// conditional on the token still being unused, and says so in its return
// value.

export function createInMemoryTokenStore(): PasswordTokenStore & { all(): StoredPasswordToken[] } {
  const rows = new Map<string, StoredPasswordToken>();
  let nextId = 1;

  return {
    async create(input) {
      const row: StoredPasswordToken = { id: `token-${nextId++}`, usedAt: null, ...input };
      rows.set(row.id, row);
      return { ...row };
    },

    async findByHash(tokenHash) {
      for (const row of rows.values()) {
        if (row.tokenHash === tokenHash) return { ...row };
      }
      return null;
    },

    async markUsed(id, usedAt) {
      const row = rows.get(id);
      if (!row || row.usedAt !== null) return false;
      row.usedAt = usedAt;
      return true;
    },

    async revokeAllForUser(userId) {
      let count = 0;
      for (const [id, row] of rows) {
        if (row.userId === userId && row.usedAt === null) {
          rows.delete(id);
          count += 1;
        }
      }
      return count;
    },

    all() {
      return [...rows.values()].map((row) => ({ ...row }));
    },
  };
}

/** A clock the test moves by hand. */
export function createFakeClock(startMs: number) {
  let current = startMs;
  return {
    now: () => new Date(current),
    advanceHours(hours: number) {
      current += hours * 60 * 60 * 1000;
    },
  };
}

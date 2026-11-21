import type { PasswordTokenStore, StoredPasswordToken } from "@/types/passwordSetup";

// In-memory token store and windable clock: expiry and the single-use race are provable here, not over HTTP.

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
        if (row.tokenHash === tokenHash) {
          return { ...row };
        }
      }
      return null;
    },

    async markUsed(id, usedAt) {
      const row = rows.get(id);
      if (!row || row.usedAt !== null) {
        return false;
      }
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

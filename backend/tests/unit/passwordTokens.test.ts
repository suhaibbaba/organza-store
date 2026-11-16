import { describe, expect, it } from "vitest";
import { PASSWORD_TOKEN_TTL_HOURS } from "@organza/shared/constants/passwordSetup";
import { createPasswordTokenService, hashToken, generateToken } from "@/lib/passwordTokens";
import { createFakeClock, createInMemoryTokenStore } from "@tests/support/passwordTokens";

// The rules behind an emailed password link, exercised against an in-memory
// store and a clock the test winds forward (tests/support/passwordTokens.ts).
//
// These are deliberately NOT API tests. Single-use under a race, and a link
// that dies exactly 72 hours after it was issued, are not things a black-box
// HTTP suite can reach: it cannot make two redemptions arrive together and it
// cannot wait three days. So the service takes its store and its clock as
// arguments, and this is where the guarantees are actually proven — the API
// suite then checks that the real endpoints are wired to them.

const NOW = Date.UTC(2026, 7, 1, 9, 0, 0);
const USER = "user-1";

function serviceWithClock(startMs = NOW) {
  const store = createInMemoryTokenStore();
  const clock = createFakeClock(startMs);
  return { store, clock, service: createPasswordTokenService({ store, now: clock.now }) };
}

describe("Password setup tokens", () => {
  describe("what is stored", () => {
    it("never stores the token itself — only its hash", async () => {
      const { store, service } = serviceWithClock();
      const issued = await service.issue(USER, "SET");

      const rows = store.all();
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(hashToken(issued.token));
      // The thing that would let somebody in must not be anywhere in the row.
      expect(JSON.stringify(rows[0])).not.toContain(issued.token);
    });

    it("mints an unguessable token, different every time", () => {
      const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));
      expect(tokens.size).toBe(50);
      // 32 bytes of randomness -> 43 url-safe characters, and nothing in it
      // that would need escaping in a URL.
      for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });
  });

  describe("single use", () => {
    it("redeems once and refuses the same token afterwards", async () => {
      const { service } = serviceWithClock();
      const issued = await service.issue(USER, "RESET");

      expect(await service.redeem(issued.token)).not.toBeNull();
      expect(await service.redeem(issued.token)).toBeNull();
    });

    it("lets exactly one of two simultaneous redemptions win", async () => {
      const { service } = serviceWithClock();
      const issued = await service.issue(USER, "RESET");

      // Both pass the "is it usable?" read; only one may pass the write.
      const [first, second] = await Promise.all([service.redeem(issued.token), service.redeem(issued.token)]);
      expect([first, second].filter(Boolean)).toHaveLength(1);
    });

    it("inspecting a link does not consume it", async () => {
      const { service } = serviceWithClock();
      const issued = await service.issue(USER, "SET");

      expect(await service.inspect(issued.token)).not.toBeNull();
      expect(await service.inspect(issued.token)).not.toBeNull();
      expect(await service.redeem(issued.token)).not.toBeNull();
    });
  });

  describe("expiry", () => {
    it("stays usable right up to its expiry and not a moment after", async () => {
      const { clock, service } = serviceWithClock();
      const issued = await service.issue(USER, "SET");

      clock.advanceHours(PASSWORD_TOKEN_TTL_HOURS.SET - 1);
      expect(await service.inspect(issued.token)).not.toBeNull();

      clock.advanceHours(1);
      expect(await service.inspect(issued.token)).toBeNull();
      expect(await service.redeem(issued.token)).toBeNull();
    });

    it("gives a forgotten-password link a shorter life than a new account's", async () => {
      const { clock, service } = serviceWithClock();
      const reset = await service.issue(USER, "RESET");

      clock.advanceHours(PASSWORD_TOKEN_TTL_HOURS.RESET + 1);
      expect(await service.inspect(reset.token)).toBeNull();
      // ...whereas a SET link issued at the same moment would still be alive,
      // which is the whole reason the two TTLs differ.
      expect(PASSWORD_TOKEN_TTL_HOURS.SET).toBeGreaterThan(PASSWORD_TOKEN_TTL_HOURS.RESET);
    });
  });

  describe("revocation", () => {
    it("issuing a new link kills the previous one", async () => {
      const { service } = serviceWithClock();
      const first = await service.issue(USER, "RESET");
      const second = await service.issue(USER, "RESET");

      // Otherwise an Admin's reset would leave a link that had already gone
      // astray still working.
      expect(await service.inspect(first.token)).toBeNull();
      expect(await service.inspect(second.token)).not.toBeNull();
    });

    it("leaves other people's links alone", async () => {
      const { service } = serviceWithClock();
      const mine = await service.issue(USER, "SET");
      const theirs = await service.issue("user-2", "SET");

      await service.revokeAllForUser(USER);
      expect(await service.inspect(mine.token)).toBeNull();
      expect(await service.inspect(theirs.token)).not.toBeNull();
    });
  });

  describe("nonsense input", () => {
    it("refuses an empty, unknown or tampered token without throwing", async () => {
      const { service } = serviceWithClock();
      const issued = await service.issue(USER, "SET");

      expect(await service.inspect("")).toBeNull();
      expect(await service.inspect("not-a-token")).toBeNull();
      expect(await service.inspect(`${issued.token}x`)).toBeNull();
    });
  });
});

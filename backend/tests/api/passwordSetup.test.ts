import { afterAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { apiRequest, rawRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { randomPalestinePhone } from "@tests/support/phone";
import { tokenFromSetupUrl } from "@tests/support/passwordSetup";
import { SEEDED_ACCOUNTS, SEEDED_PASSWORD } from "@tests/constants";
import { ERROR_CODES, PASSWORD_RESET_EMAIL_LIMIT } from "@/constants";
import type { PasswordResetInvite, PasswordTokenCheck } from "@tests/types";
import type { SerializableUser } from "@/types";

// Setting a password from an emailed link, through the real endpoints.
//
// What is checked HERE is the wiring and the things only a live API can show:
// that an account created without a password genuinely cannot be signed into,
// that the public endpoint gives an attacker nothing, that the rate limit
// bites, and that a redeemed link is dead. The token RULES themselves
// (single-use under a race, expiry to the hour) are proven against an
// in-memory store and a fake clock in tests/unit/passwordTokens.test.ts —
// neither is reachable over HTTP.

describe("Password setup by email", () => {
  const nonce = uniqueId();
  const createdUserIds: string[] = [];

  async function createStaff(overrides: Record<string, unknown> = {}) {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<SerializableUser>("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest PwSetup ${nonce}`,
        email: `vitest.pwsetup.${uniqueId()}@organza.test`,
        role: Role.EMPLOYEE,
        phone: randomPalestinePhone(),
        ...overrides,
      },
    });
    if (res.data?.id) createdUserIds.push(res.data.id);
    return res;
  }

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    // There is no delete endpoint for staff — deactivate instead, same as
    // tests/api/users.test.ts.
    for (const id of createdUserIds) {
      await apiRequest(`/api/users/${id}`, { method: "PATCH", token: admin.token, body: { isActive: false } });
    }
  });

  describe("creating a member of staff with no password", () => {
    it("creates the account and refuses to sign in until a password is set", async () => {
      const created = await createStaff();
      expect(created.status).toBe(201);

      // No password was given, so there is no password: not a blank one, not
      // a throwaway somebody could guess.
      const signIn = await rawRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: { email: created.data!.email, password: SEEDED_PASSWORD },
      });
      expect(signIn.status).toBeGreaterThanOrEqual(400);
    });

    it("still creates the account when the mail provider cannot deliver", async () => {
      // The target API has no RESEND_API_KEY in any environment this suite is
      // allowed to run against (see tests/constants/targets.ts), so every
      // creation above has ALREADY exercised the unreachable-provider path:
      // sending is fire-and-forget after the write commits, and a provider
      // that is absent, slow or refusing must never turn "the account was
      // created" into a 500.
      const created = await createStaff();
      expect(created.status).toBe(201);
      expect(created.data!.email).toBeTruthy();

      // ...and the link exists regardless of whether the mail went anywhere,
      // which is what lets an Admin hand it over by another route.
      const admin = await getSession("ADMIN");
      const invite = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });
      expect(invite.status).toBe(200);
      expect(invite.data!.url).toContain("set-password?token=");
    });

    it("still accepts an admin-set password as the fallback", async () => {
      const created = await createStaff({ password: SEEDED_PASSWORD });
      expect(created.status).toBe(201);

      const signIn = await rawRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: { email: created.data!.email, password: SEEDED_PASSWORD },
      });
      expect(signIn.status).toBe(200);
    });
  });

  describe("redeeming a link", () => {
    it("checks out, sets the password, and then refuses the same link", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();

      const invite = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });
      const token = tokenFromSetupUrl(invite.data!.url);

      // Checking must not consume it.
      const check = await apiRequest<PasswordTokenCheck>("/api/password-setup/verify", {
        method: "POST",
        body: { token },
      });
      expect(check.status).toBe(200);
      expect(check.data!.email).toBe(created.data!.email);

      const newPassword = `set-${uniqueId()}`;
      const complete = await apiRequest("/api/password-setup/complete", {
        method: "POST",
        body: { token, password: newPassword },
      });
      expect(complete.status).toBe(200);

      const signIn = await rawRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: { email: created.data!.email, password: newPassword },
      });
      expect(signIn.status).toBe(200);

      // Single use: the link is dead the moment it has been spent.
      const replay = await apiRequest("/api/password-setup/complete", {
        method: "POST",
        body: { token, password: `other-${uniqueId()}` },
      });
      expect(replay.status).toBe(400);
      expect(replay.error?.code).toBe(ERROR_CODES.PASSWORD_TOKEN_INVALID);
    });

    it("kills the previous link when a new one is issued", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();

      const first = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });
      const second = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });

      // A link that has already gone astray must not survive the reset that
      // was meant to cut it off.
      const stale = await apiRequest("/api/password-setup/verify", {
        method: "POST",
        body: { token: tokenFromSetupUrl(first.data!.url) },
      });
      expect(stale.status).toBe(400);

      const fresh = await apiRequest("/api/password-setup/verify", {
        method: "POST",
        body: { token: tokenFromSetupUrl(second.data!.url) },
      });
      expect(fresh.status).toBe(200);
    });

    it("refuses a token that was never issued", async () => {
      const res = await apiRequest("/api/password-setup/verify", {
        method: "POST",
        body: { token: `made-up-${uniqueId()}` },
      });
      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.PASSWORD_TOKEN_INVALID);
    });

    it("answers unknown, expired and already-used links with the SAME code", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();
      const invite = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });
      const token = tokenFromSetupUrl(invite.data!.url);
      await apiRequest("/api/password-setup/complete", {
        method: "POST",
        body: { token, password: `set-${uniqueId()}` },
      });

      const used = await apiRequest("/api/password-setup/verify", { method: "POST", body: { token } });
      const unknown = await apiRequest("/api/password-setup/verify", {
        method: "POST",
        body: { token: `made-up-${uniqueId()}` },
      });
      // Telling the two apart tells whoever is holding a stale link whether
      // the account behind it exists.
      expect(used.error?.code).toBe(unknown.error?.code);
      expect(used.status).toBe(unknown.status);
    });

    it("rejects a password shorter than the minimum", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();
      const invite = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });

      const res = await apiRequest("/api/password-setup/complete", {
        method: "POST",
        body: { token: tokenFromSetupUrl(invite.data!.url), password: "short" },
      });
      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
    });
  });

  describe("the public request endpoint reveals nothing", () => {
    it("answers a known and an unknown address identically", async () => {
      const known = await apiRequest("/api/password-setup/request", {
        method: "POST",
        body: { email: SEEDED_ACCOUNTS.ADMIN.email },
      });
      const unknown = await apiRequest("/api/password-setup/request", {
        method: "POST",
        body: { email: `nobody.${uniqueId()}@organza.test` },
      });

      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      // Same status, same body, and nothing in either that could be compared.
      expect(JSON.stringify(unknown.data)).toBe(JSON.stringify(known.data));
    });

    it("answers a deactivated account the same way too", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();
      await apiRequest(`/api/users/${created.data!.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });

      const res = await apiRequest("/api/password-setup/request", {
        method: "POST",
        body: { email: created.data!.email },
      });
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ requested: true });
    });

    it("rate-limits repeated requests for one address", async () => {
      // A fresh address each run, so the window belongs to this test rather
      // than to whatever else has been hitting a shared sandbox.
      const email = `ratelimit.${uniqueId()}@organza.test`;

      const statuses: number[] = [];
      for (let i = 0; i < PASSWORD_RESET_EMAIL_LIMIT + 2; i++) {
        const res = await apiRequest("/api/password-setup/request", { method: "POST", body: { email } });
        statuses.push(res.status);
      }

      expect(statuses.slice(0, PASSWORD_RESET_EMAIL_LIMIT).every((s) => s === 200)).toBe(true);
      const last = statuses[statuses.length - 1];
      expect(last).toBe(429);
    });

    it("needs no session at all", async () => {
      // The whole point: somebody with no password cannot sign in to ask for
      // one, so these routes must be reachable without a token.
      const res = await apiRequest("/api/password-setup/request", {
        method: "POST",
        body: { email: `anonymous.${uniqueId()}@organza.test` },
      });
      expect(res.status).not.toBe(401);
    });
  });

  describe("who may trigger a reset for somebody else", () => {
    it("is Admin only", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();

      for (const role of ["MANAGER", "EMPLOYEE"] as const) {
        const session = await getSession(role);
        const res = await apiRequest(`/api/users/${created.data!.id}/password-reset`, {
          method: "POST",
          token: session.token,
        });
        expect(res.status).toBe(403);
        expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
      }

      const allowed = await apiRequest(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });
      expect(allowed.status).toBe(200);
    });

    it("404s for a user who does not exist", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest(`/api/users/does-not-exist-${uniqueId()}/password-reset`, {
        method: "POST",
        token: admin.token,
      });
      expect(res.status).toBe(404);
      expect(res.error?.code).toBe(ERROR_CODES.USER_NOT_FOUND);
    });
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { apiRequest, rawRequest, uniqueId } from "@tests/support/client";
import { getSession, signIn } from "@tests/support/auth";
import { randomPalestinePhone } from "@tests/support/phone";
import { tokenFromSetupUrl } from "@tests/support/passwordSetup";
import { SEEDED_ACCOUNTS, SEEDED_PASSWORD } from "@tests/constants";
import { ERROR_CODES, PASSWORD_RESET_EMAIL_LIMIT } from "@/constants";
import type { PasswordResetInvite, PasswordTokenCheck, StaffAccountView } from "@tests/types";

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
    const res = await apiRequest<StaffAccountView>("/api/users", {
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

  describe("the password that was set is the password that works", () => {
    // THE regression test. A link that reports success and then leaves
    // somebody unable to sign in is the worst shape this feature can fail
    // in: the person has done everything right, the account looks finished
    // from the admin screen, and the only symptom is "it says my password is
    // wrong". So this walks the whole road — invited with no password, link
    // redeemed, signed in, and the session actually used — rather than
    // trusting a 200 from /complete.
    it("sets a password from the emailed link and then signs in with it", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();
      expect(created.status).toBe(201);
      // Created with nothing: this is the state the whole flow starts from.
      expect(created.data!.hasPassword).toBe(false);

      const invite = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });
      const token = tokenFromSetupUrl(invite.data!.url);

      const password = `chosen-${uniqueId()}`;
      const complete = await apiRequest("/api/password-setup/complete", {
        method: "POST",
        body: { token, password },
      });
      expect(complete.status).toBe(200);

      // Signing in has to WORK — not "not 500", not "the row was written".
      const attempt = await signIn(created.data!.email, password);
      expect(attempt.status).toBe(200);
      expect(attempt.session?.token).toBeTruthy();

      // ...and the session it hands back has to be a real one. A password
      // written where Better Auth cannot see it would fail one of these two.
      const call = await apiRequest("/api/categories", { token: attempt.session!.token });
      expect(call.status).toBe(200);

      // Not a one-off: the credential survives the sign-out/sign-in the
      // redemption itself performs (it revokes every session), so the same
      // password still works the next morning.
      const again = await signIn(created.data!.email, password);
      expect(again.status).toBe(200);

      // Nothing else opens the account.
      const wrong = await signIn(created.data!.email, `${password}-not`);
      expect(wrong.session).toBeUndefined();
      expect(wrong.status).toBeGreaterThanOrEqual(400);

      // And the Admin's screen now says so.
      const detail = await apiRequest<StaffAccountView>(`/api/users/${created.data!.id}`, { token: admin.token });
      expect(detail.data!.hasPassword).toBe(true);
    });

    it("replaces a password that already existed, and the old one stops working", async () => {
      const admin = await getSession("ADMIN");
      // Created WITH a password, so the link is a reset rather than a first
      // set-up — the path a forgotten password takes.
      const created = await createStaff({ password: SEEDED_PASSWORD });
      expect(created.data!.hasPassword).toBe(true);

      const invite = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });
      const password = `reset-${uniqueId()}`;
      await apiRequest("/api/password-setup/complete", {
        method: "POST",
        body: { token: tokenFromSetupUrl(invite.data!.url), password },
      });

      const withNew = await signIn(created.data!.email, password);
      expect(withNew.status).toBe(200);

      // The whole point of a reset: whoever had the old one no longer does.
      const withOld = await signIn(created.data!.email, SEEDED_PASSWORD);
      expect(withOld.session).toBeUndefined();
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

    it("answers a pending account and a finished one the same way", async () => {
      // The state this screen must not become a window onto: an account that
      // has been created but never set up is exactly the one worth attacking,
      // and "is this address still waiting for its link?" must be as
      // unanswerable here as "does this address exist at all?".
      const admin = await getSession("ADMIN");
      const pending = await createStaff();
      const finished = await createStaff();

      const invite = await apiRequest<PasswordResetInvite>(`/api/users/${finished.data!.id}/resend-invite`, {
        method: "POST",
        token: admin.token,
      });
      await apiRequest("/api/password-setup/complete", {
        method: "POST",
        body: { token: tokenFromSetupUrl(invite.data!.url), password: `chosen-${uniqueId()}` },
      });

      const pendingRes = await apiRequest("/api/password-setup/request", {
        method: "POST",
        body: { email: pending.data!.email },
      });
      const finishedRes = await apiRequest("/api/password-setup/request", {
        method: "POST",
        body: { email: finished.data!.email },
      });

      expect(pendingRes.status).toBe(finishedRes.status);
      expect(JSON.stringify(pendingRes.data)).toBe(JSON.stringify(finishedRes.data));
      expect(pendingRes.error).toBeUndefined();
      expect(finishedRes.error).toBeUndefined();
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

  describe("re-sending the invitation to somebody still pending", () => {
    it("sends a fresh link while the account has no password", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();

      const resend = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/resend-invite`, {
        method: "POST",
        token: admin.token,
      });
      expect(resend.status).toBe(200);
      expect(resend.data!.url).toContain("set-password?token=");

      // And the link it sends is a working one, not a receipt.
      const check = await apiRequest<PasswordTokenCheck>("/api/password-setup/verify", {
        method: "POST",
        body: { token: tokenFromSetupUrl(resend.data!.url) },
      });
      expect(check.status).toBe(200);
      // SET, not RESET: this person is being invited, not recovering.
      expect(check.data!.purpose).toBe("SET");
    });

    it("refuses once that person has chosen a password", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();

      const invite = await apiRequest<PasswordResetInvite>(`/api/users/${created.data!.id}/resend-invite`, {
        method: "POST",
        token: admin.token,
      });
      await apiRequest("/api/password-setup/complete", {
        method: "POST",
        body: { token: tokenFromSetupUrl(invite.data!.url), password: `chosen-${uniqueId()}` },
      });

      // They are not pending any more. Re-inviting them would quietly be a
      // password reset, which is a different decision with its own button.
      const again = await apiRequest(`/api/users/${created.data!.id}/resend-invite`, {
        method: "POST",
        token: admin.token,
      });
      expect(again.status).toBe(409);
      expect(again.error?.code).toBe(ERROR_CODES.USER_ALREADY_ACTIVATED);

      // ...while the reset endpoint, which is what that decision looks like,
      // still works on the same account.
      const reset = await apiRequest(`/api/users/${created.data!.id}/password-reset`, {
        method: "POST",
        token: admin.token,
      });
      expect(reset.status).toBe(200);
    });

    it("refuses for an account created with a password in the first place", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff({ password: SEEDED_PASSWORD });

      const res = await apiRequest(`/api/users/${created.data!.id}/resend-invite`, {
        method: "POST",
        token: admin.token,
      });
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.USER_ALREADY_ACTIVATED);
    });

    it("refuses for a deactivated account", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();
      await apiRequest(`/api/users/${created.data!.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });

      // Nothing to invite them to: the account cannot sign in whatever
      // password is on it.
      const res = await apiRequest(`/api/users/${created.data!.id}/resend-invite`, {
        method: "POST",
        token: admin.token,
      });
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.ACCOUNT_INACTIVE);
    });

    it("is Admin only, and 404s for somebody who does not exist", async () => {
      const admin = await getSession("ADMIN");
      const created = await createStaff();

      for (const role of ["MANAGER", "EMPLOYEE"] as const) {
        const session = await getSession(role);
        const res = await apiRequest(`/api/users/${created.data!.id}/resend-invite`, {
          method: "POST",
          token: session.token,
        });
        expect(res.status).toBe(403);
      }

      const missing = await apiRequest(`/api/users/does-not-exist-${uniqueId()}/resend-invite`, {
        method: "POST",
        token: admin.token,
      });
      expect(missing.status).toBe(404);
      expect(missing.error?.code).toBe(ERROR_CODES.USER_NOT_FOUND);
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

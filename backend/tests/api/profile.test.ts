// A person's own account (/api/me): what they may change, and that it never reaches anybody else's.
import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, rawRequest, uniqueId } from "@tests/support/client";
import { getSession, signIn } from "@tests/support/auth";
import { randomPalestinePhone, samePhoneUnderOtherPrefix } from "@tests/support/phone";
import { SEEDED_PASSWORD } from "@tests/constants";
import { ERROR_CODES } from "@/constants";
import type { Profile, ProfileSession } from "@organza/shared/types/profile";
import type { StaffAccountView } from "@tests/types";

const NEW_PASSWORD = `${SEEDED_PASSWORD}-new`;

describe("My profile", () => {
  const strays: string[] = [];

  async function createStaff(label: string): Promise<StaffAccountView> {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<StaffAccountView>("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest ${label}`,
        email: `vitest.${label}.${uniqueId()}@organza.test`,
        password: SEEDED_PASSWORD,
        role: "EMPLOYEE",
        phone: randomPalestinePhone(),
      },
    });
    expect(res.status, "the fixture account must be created").toBe(201);
    strays.push(res.data!.id);
    return res.data!;
  }

  async function signInAs(email: string, password = SEEDED_PASSWORD): Promise<string> {
    const result = await signIn(email, password);
    expect(result.session, `sign-in as ${email}`).toBeTruthy();
    return result.session!.token;
  }

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of strays) await apiRequest(`/api/users/${id}`, { method: "DELETE", token: admin.token });
  });

  it("needs a session", async () => {
    const res = await apiRequest("/api/me");
    expect(res.status).toBe(401);
  });

  it("returns the caller's own account, without the Admin-only ID number", async () => {
    const account = await createStaff("me-read");
    const token = await signInAs(account.email);
    const res = await apiRequest<Profile & { idNumber?: unknown }>("/api/me", { token });
    expect(res.status).toBe(200);
    expect(res.data!.id).toBe(account.id);
    expect(res.data!.email).toBe(account.email);
    expect(res.data!.locale).toBeNull();
    expect(res.data).not.toHaveProperty("idNumber");
  });

  it("changes name, numbers and language, and refuses role, email and ID number", async () => {
    const account = await createStaff("me-edit");
    const token = await signInAs(account.email);
    const phone = randomPalestinePhone();

    const ok = await apiRequest<Profile>("/api/me", {
      method: "PATCH",
      token,
      body: { name: "Vitest renamed", phone, whatsapp: phone, locale: "en" },
    });
    expect(ok.status).toBe(200);
    expect(ok.data).toMatchObject({ name: "Vitest renamed", phone, whatsapp: phone, locale: "en" });

    for (const body of [{ role: "ADMIN" }, { email: "x@organza.test" }, { idNumber: "123" }]) {
      const refused = await apiRequest("/api/me", { method: "PATCH", token, body });
      expect(refused.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("refuses a phone another account holds under the other Palestine prefix", async () => {
    const owner = await createStaff("me-phone-owner");
    const account = await createStaff("me-phone");
    const token = await signInAs(account.email);
    const res = await apiRequest("/api/me", {
      method: "PATCH",
      token,
      body: { phone: samePhoneUnderOtherPrefix(owner.phone) },
    });
    expect(res.status).toBe(409);
    expect(res.error?.code).toBe(ERROR_CODES.PHONE_DUPLICATE);
  });

  it("changes the password only with the current one, and signs out every other device", async () => {
    const account = await createStaff("me-password");
    const token = await signInAs(account.email);
    const otherDevice = await signInAs(account.email);

    const wrong = await apiRequest("/api/me/password", {
      method: "POST",
      token,
      body: { currentPassword: "not-the-password", newPassword: NEW_PASSWORD },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.error?.code).toBe(ERROR_CODES.PROFILE_WRONG_PASSWORD);

    const ok = await apiRequest("/api/me/password", {
      method: "POST",
      token,
      body: { currentPassword: SEEDED_PASSWORD, newPassword: NEW_PASSWORD },
    });
    expect(ok.status).toBe(200);

    expect((await apiRequest("/api/me", { token })).status, "this device stays signed in").toBe(200);
    expect((await apiRequest("/api/me", { token: otherDevice })).status, "the other device is out").toBe(401);
    expect((await signIn(account.email, SEEDED_PASSWORD)).session, "the old password is dead").toBeFalsy();
    expect((await signIn(account.email, NEW_PASSWORD)).session, "the new one works").toBeTruthy();
  });

  it("lists this person's devices and signs one out, never this one or somebody else's", async () => {
    const account = await createStaff("me-sessions");
    const stranger = await createStaff("me-sessions-stranger");
    const token = await signInAs(account.email);
    const otherDevice = await signInAs(account.email);
    const strangerToken = await signInAs(stranger.email);

    const list = await apiRequest<ProfileSession[]>("/api/me/sessions", { token });
    expect(list.status).toBe(200);
    expect(list.data!).toHaveLength(2);
    const current = list.data!.find((session) => session.current)!;
    const other = list.data!.find((session) => !session.current)!;
    expect(current).toBeTruthy();
    expect(other).toBeTruthy();

    const self = await apiRequest(`/api/me/sessions/${current.id}`, { method: "DELETE", token });
    expect(self.status).toBe(404);

    const notMine = await apiRequest(`/api/me/sessions/${other.id}`, { method: "DELETE", token: strangerToken });
    expect(notMine.status).toBe(404);

    const revoked = await apiRequest(`/api/me/sessions/${other.id}`, { method: "DELETE", token });
    expect(revoked.status).toBe(200);
    expect((await apiRequest("/api/me", { token: otherDevice })).status).toBe(401);
    expect((await apiRequest("/api/me", { token })).status).toBe(200);
  });

  it("signs out every other device at once", async () => {
    const account = await createStaff("me-sessions-all");
    const token = await signInAs(account.email);
    const second = await signInAs(account.email);
    const third = await signInAs(account.email);

    const res = await apiRequest("/api/me/sessions", { method: "DELETE", token });
    expect(res.status).toBe(200);
    expect((await apiRequest("/api/me", { token: second })).status).toBe(401);
    expect((await apiRequest("/api/me", { token: third })).status).toBe(401);
    const list = await apiRequest<ProfileSession[]>("/api/me/sessions", { token });
    expect(list.data!.map((session) => session.current)).toEqual([true]);
  });

  it("closes Better Auth's own update-user and change-password, so /api/me is the only way in", async () => {
    const account = await createStaff("me-closed");
    const token = await signInAs(account.email);

    const update = await rawRequest("/api/auth/update-user", { method: "POST", token, body: { name: "Vitest bypass" } });
    expect(update.status).toBe(404);

    const change = await rawRequest("/api/auth/change-password", {
      method: "POST",
      token,
      body: { currentPassword: SEEDED_PASSWORD, newPassword: NEW_PASSWORD, revokeOtherSessions: false },
    });
    expect(change.status).toBe(404);

    const me = await apiRequest<Profile>("/api/me", { token });
    expect(me.data!.name).toBe(account.name);
    expect((await signIn(account.email, SEEDED_PASSWORD)).session, "the password is unchanged").toBeTruthy();
  });
});

// Deactivate keeps every record naming them (the anti-theft design); delete is only for an account that never did anything.
import { afterAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { apiRequest, rawRequest, uniqueId } from "@tests/support/client";
import { getSession, signIn } from "@tests/support/auth";
import { randomPalestinePhone } from "@tests/support/phone";
import { createSellableProduct } from "@tests/support/orders";
import { SEEDED_ACCOUNTS, SEEDED_PASSWORD } from "@tests/constants";
import { ERROR_CODES } from "@/constants";
import type { SeededRole, StaffAccountView } from "@tests/types";

describe("Staff account removal", () => {
  const strays: string[] = [];

  /** A fresh account with a password, so it can actually sign in. */
  async function createStaff(label: string, role: Role = Role.EMPLOYEE): Promise<StaffAccountView> {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<StaffAccountView>("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest ${label}`,
        email: `vitest.${label}.${uniqueId()}@store.test`,
        password: SEEDED_PASSWORD,
        role,
        phone: randomPalestinePhone(),
      },
    });
    expect(res.status, "the fixture account must be created").toBe(201);
    strays.push(res.data!.id);
    return res.data!;
  }

  /** A fixture that has worked; never the seeded Employee, whose shared session deactivation would revoke for every suite. */
  async function createWorkingStaff(
    label: string,
  ): Promise<{ account: StaffAccountView; token: string; orderId: string }> {
    const admin = await getSession("ADMIN");
    const account = await createStaff(label);

    const signedIn = await signIn(account.email, SEEDED_PASSWORD);
    const token = signedIn.session!.token;

    const product = await createSellableProduct(admin.token, { stock: 5 });
    const order = await apiRequest<{ id: string; createdById: string }>("/api/orders", {
      method: "POST",
      token,
      body: { channel: "STORE", items: [{ productId: product.id, quantity: 1 }] },
    });
    expect(order.status, "the fixture must be able to ring up a sale").toBe(201);
    expect(order.data!.createdById).toBe(account.id);

    return { account, token, orderId: order.data!.id };
  }

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of strays) {
      const deleted = await apiRequest(`/api/users/${id}`, { method: "DELETE", token: admin.token });
      // Already gone or it picked up history: either way the run must not fail here.
      if (deleted.status !== 200) {
        await apiRequest(`/api/users/${id}`, { method: "PATCH", token: admin.token, body: { isActive: false } });
      }
    }
  });

  // --------------------------------------------------------------------------
  describe("deactivation", () => {
    it("kills the sessions they already have, not just the next sign-in", async () => {
      const admin = await getSession("ADMIN");
      const staff = await createStaff("deactivate-live");

      const signedIn = await signIn(staff.email, SEEDED_PASSWORD);
      const token = signedIn.session!.token;
      expect(
        (await apiRequest("/api/categories", { token })).status,
        "the fixture must be genuinely signed in first",
      ).toBe(200);

      const off = await apiRequest(`/api/users/${staff.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });
      expect(off.status).toBe(200);

      // The token is dead the moment the switch flips: routes/users.ts revokes sessions explicitly.
      const replayed = await apiRequest("/api/categories", { token });
      expect(replayed.status, "the session they already had must be dead").toBe(401);
    });

    it("blocks signing in again", async () => {
      const admin = await getSession("ADMIN");
      const staff = await createStaff("deactivate-signin");

      await apiRequest(`/api/users/${staff.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });

      // Better Auth ignores isActive; the session hook in lib/auth.ts refuses it, or sign-in lands on all 403s.
      const attempt = await rawRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: { email: staff.email, password: SEEDED_PASSWORD },
      });
      expect(attempt.status).toBe(403);
      expect(attempt.body?.token, "no session may be handed out").toBeFalsy();
    });

    it("is reversible — putting somebody back lets them sign in again", async () => {
      const admin = await getSession("ADMIN");
      const staff = await createStaff("reactivate");

      await apiRequest(`/api/users/${staff.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });
      const back = await apiRequest<StaffAccountView>(`/api/users/${staff.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: true },
      });
      expect(back.status).toBe(200);
      expect(back.data!.isActive).toBe(true);

      const attempt = await signIn(staff.email, SEEDED_PASSWORD);
      expect(attempt.session?.token, "they must be able to sign in again").toBeTruthy();
    });

    it("keeps everything they did — deactivating is not erasing", async () => {
      const admin = await getSession("ADMIN");
      const { account, orderId } = await createWorkingStaff("deactivate-keeps");

      const off = await apiRequest(`/api/users/${account.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });
      expect(off.status).toBe(200);

      // The sale still names who rang it up: the promise "their history stays" makes.
      const order = await apiRequest<{ id: string; createdById: string; createdBy: { name: string } | null }>(
        `/api/orders/${orderId}`,
        { token: admin.token },
      );
      expect(order.status).toBe(200);
      expect(order.data!.createdById).toBe(account.id);
      expect(order.data!.createdBy?.name).toBe(account.name);
    });
  });

  // --------------------------------------------------------------------------
  describe("permanent deletion", () => {
    it("erases an account that never did anything, along with its credentials", async () => {
      const admin = await getSession("ADMIN");
      const staff = await createStaff("delete-clean");
      expect(staff.hasHistory, "a brand-new account has no history").toBe(false);

      const deleted = await apiRequest<{ id: string; deleted: boolean }>(`/api/users/${staff.id}`, {
        method: "DELETE",
        token: admin.token,
      });
      expect(deleted.status).toBe(200);
      expect(deleted.data!.deleted).toBe(true);

      // Gone, not hidden: staff have no soft delete, so only an account with nothing behind it.
      const gone = await apiRequest(`/api/users/${staff.id}`, { token: admin.token });
      expect(gone.status).toBe(404);
      expect(gone.error?.code).toBe(ERROR_CODES.USER_NOT_FOUND);

      // The credential row cascades, so the old password cannot reach a resurrected account.
      const attempt = await signIn(staff.email, SEEDED_PASSWORD);
      expect(attempt.session).toBeUndefined();
    });

    it("refuses an account that has taken an order, and says to deactivate instead", async () => {
      const admin = await getSession("ADMIN");
      const { account } = await createWorkingStaff("delete-worked");

      const res = await apiRequest(`/api/users/${account.id}`, { method: "DELETE", token: admin.token });
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.USER_HAS_HISTORY);

      // A refusal is total: the account is untouched, still active.
      const still = await apiRequest<StaffAccountView>(`/api/users/${account.id}`, { token: admin.token });
      expect(still.status).toBe(200);
      expect(still.data!.isActive).toBe(true);
      expect(still.data!.hasHistory).toBe(true);
    });

    it("refuses an account whose only history is an audit entry", async () => {
      const admin = await getSession("ADMIN");
      const staff = await createStaff("delete-audited");

      // A password-link request writes an audit entry in their name, and any history makes them unerasable.
      const requested = await apiRequest("/api/password-setup/request", {
        method: "POST",
        body: { email: staff.email },
      });
      expect(requested.status).toBe(200);

      const res = await apiRequest(`/api/users/${staff.id}`, { method: "DELETE", token: admin.token });
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.USER_HAS_HISTORY);
    });

    it("never leaves a half-deleted account behind when it refuses", async () => {
      const admin = await getSession("ADMIN");
      const { account, orderId } = await createWorkingStaff("delete-refused");

      const refused = await apiRequest(`/api/users/${account.id}`, { method: "DELETE", token: admin.token });
      expect(refused.status).toBe(409);

      // The order still names them: a cascade or SET NULL would show a sale with no author.
      const order = await apiRequest<{ createdById: string | null }>(`/api/orders/${orderId}`, {
        token: admin.token,
      });
      expect(order.status).toBe(200);
      expect(order.data!.createdById).toBe(account.id);
    });

    it("reports 404 for an account that does not exist", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/users/not-a-real-user-id", { method: "DELETE", token: admin.token });
      expect(res.status).toBe(404);
    });
  });

  // --------------------------------------------------------------------------
  describe("guards", () => {
    it("refuses an Admin removing their own account, both ways", async () => {
      const admin = await getSession("ADMIN");

      const deleted = await apiRequest(`/api/users/${admin.userId}`, { method: "DELETE", token: admin.token });
      expect(deleted.status).toBe(409);
      expect(deleted.error?.code).toBe(ERROR_CODES.USER_SELF_REMOVAL);

      const deactivated = await apiRequest(`/api/users/${admin.userId}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });
      expect(deactivated.status).toBe(409);
      expect(deactivated.error?.code).toBe(ERROR_CODES.USER_SELF_REMOVAL);

      // Self-edit is fine, only removal is refused; restored after, since every sandbox screen signs in as this account.
      const before = await apiRequest<StaffAccountView>(`/api/users/${admin.userId}`, {
        token: admin.token,
      });
      expect(before.status).toBe(200);

      const renamed = await apiRequest<StaffAccountView>(`/api/users/${admin.userId}`, {
        method: "PATCH",
        token: admin.token,
        body: { name: "Vitest Self Edit" },
      });
      expect(renamed.status).toBe(200);
      expect(renamed.data?.name).toBe("Vitest Self Edit");

      const restored = await apiRequest<StaffAccountView>(`/api/users/${admin.userId}`, {
        method: "PATCH",
        token: admin.token,
        body: { name: before.data!.name },
      });
      expect(restored.status).toBe(200);
      expect(restored.data?.name).toBe(before.data!.name);
    });

    it("protects the last active Admin from being demoted away", async () => {
      const admin = await getSession("ADMIN");
      const admins = await apiRequest<StaffAccountView[]>("/api/users?role=ADMIN&isActive=true&pageSize=50", {
        token: admin.token,
      });
      expect(admins.status).toBe(200);
      // Only meaningful with exactly one Admin.
      if ((admins.data ?? []).length !== 1) {
        return;
      }

      const res = await apiRequest(`/api/users/${admin.userId}`, {
        method: "PATCH",
        token: admin.token,
        body: { role: "MANAGER" },
      });
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.USER_LAST_ADMIN);
    });

    it.each(["MANAGER", "EMPLOYEE"] as SeededRole[])("refuses a %s outright, both ways", async (role) => {
      const session = await getSession(role);
      // They cannot read the staff list, so they have no id to aim at.
      const list = await apiRequest("/api/users", { token: session.token });
      expect(list.status).toBe(403);
      expect(list.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      // Refused on the route (rule 5), both verbs (user.manage, user.delete); a fixture target keeps suites independent.
      const victim = await createStaff(`refused-${role.toLowerCase()}`);

      const deleted = await apiRequest(`/api/users/${victim.id}`, {
        method: "DELETE",
        token: session.token,
      });
      expect(deleted.status).toBe(403);
      expect(deleted.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      const deactivated = await apiRequest(`/api/users/${victim.id}`, {
        method: "PATCH",
        token: session.token,
        body: { isActive: false },
      });
      expect(deactivated.status).toBe(403);
      expect(deactivated.error?.code).toBe(ERROR_CODES.FORBIDDEN);

      // ...and it really is untouched.
      const admin = await getSession("ADMIN");
      const untouched = await apiRequest<StaffAccountView>(`/api/users/${victim.id}`, { token: admin.token });
      expect(untouched.data!.isActive).toBe(true);
    });

    it("refuses an unauthenticated caller", async () => {
      const employee = await getSession("EMPLOYEE");
      const res = await apiRequest(`/api/users/${employee.userId}`, { method: "DELETE" });
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  describe("what the staff list says", () => {
    it("carries the three states an Admin has to tell apart", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest<StaffAccountView[]>(
        `/api/users?q=${encodeURIComponent(SEEDED_ACCOUNTS.EMPLOYEE.email)}`,
        { token: admin.token },
      );
      expect(res.status).toBe(200);

      for (const user of res.data ?? []) {
        // Active or not, invited-but-not-set-up, and whether removal could ever mean erasure.
        expect(typeof user.isActive).toBe("boolean");
        expect(typeof user.hasPassword).toBe("boolean");
        expect(typeof user.hasHistory).toBe("boolean");
      }

      // The seeded staff have all worked, so the list must not offer a delete the API would refuse.
      const employee = (res.data ?? []).find((user) => user.email === SEEDED_ACCOUNTS.EMPLOYEE.email);
      expect(employee?.hasHistory).toBe(true);
    });
  });
});

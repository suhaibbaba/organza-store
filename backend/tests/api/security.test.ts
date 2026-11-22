// One test per SECURITY-AUDIT.md finding: each failed before its fix, so this file notices one coming back.
import { describe, expect, it } from "vitest";
import { API_BASE_URL, API_ORIGIN, apiRequest, rawRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import { ERROR_CODES } from "@/constants";
import type { SeededRole } from "@tests/types";

describe("Security", () => {
  // C1: sign-up was public, handing anybody a signed-in Employee account and every customer's details.
  describe("nobody can sign themselves up", () => {
    it("refuses anonymous account creation", async () => {
      const { status, body } = await rawRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: {
          email: `intruder-${uniqueId()}@evil.example`,
          password: "hunter2hunter2",
          name: "Intruder",
          phone: `+97059${Math.floor(1000000 + Math.random() * 8999999)}`,
        },
      });

      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
      // No session under any spelling: this field used to hold a working bearer token.
      expect(body?.token).toBeFalsy();
      expect(body?.user).toBeFalsy();
    });

    it("refuses it for a signed-in caller too, so it cannot be used to mint a second account", async () => {
      const employee = await getSession("EMPLOYEE");
      const { status, body } = await rawRequest("/api/auth/sign-up/email", {
        method: "POST",
        token: employee.token,
        body: {
          email: `intruder-${uniqueId()}@evil.example`,
          password: "hunter2hunter2",
          name: "Intruder",
          phone: `+97059${Math.floor(1000000 + Math.random() * 8999999)}`,
        },
      });

      expect(status).toBeGreaterThanOrEqual(400);
      expect(body?.token).toBeFalsy();
    });

    it("still lets an Admin create staff, which is the path that had to keep working", async () => {
      const admin = await getSession("ADMIN");
      const email = `audit-staff-${uniqueId()}@store.test`;

      const res = await apiRequest<{ id: string; role: string; hasPassword: boolean }>("/api/users", {
        method: "POST",
        token: admin.token,
        body: {
          name: "Audit Staff",
          email,
          role: "EMPLOYEE",
          phone: `+97059${Math.floor(1000000 + Math.random() * 8999999)}`,
        },
      });

      expect(res.status).toBe(201);
      expect(res.data!.role).toBe("EMPLOYEE");
      // Created with no password (rule 17), so there is no throwaway secret to leak.
      expect(res.data!.hasPassword).toBe(false);
    });
  });

  // L1: idNumber (Admin-only, rule 19) and phone (unique across both prefixes, rule 18) are not the owner's to rewrite.
  describe("staff cannot rewrite their own protected fields", () => {
    it.each(["idNumber", "phone", "whatsapp", "role", "isActive"])(
      "does not let an Employee set their own %s through Better Auth's update-user",
      async (field) => {
        const employee = await getSession("EMPLOYEE");
        const before = await apiRequest<{ role: string }>("/api/users", { token: employee.token });
        // The users list is Admin-only, so an Employee cannot even read it.
        expect(before.status).toBe(403);

        const values: Record<string, unknown> = {
          idNumber: "999999999",
          phone: "+972500000999",
          whatsapp: "+972500000998",
          role: "ADMIN",
          isActive: false,
        };

        await rawRequest("/api/auth/update-user", {
          method: "POST",
          token: employee.token,
          body: { [field]: values[field] },
        });

        // Whatever that request did, the session's role must be unchanged: that would be the breach.
        const session = await rawRequest("/api/auth/get-session", { token: employee.token });
        expect(session.body?.user?.role).toBe("EMPLOYEE");
        expect(session.body?.user?.idNumber ?? null).not.toBe("999999999");
        expect(session.body?.user?.isActive).toBe(true);
      },
    );
  });

  // M2: the clients now await sign-out, which is worth something only if the server really revokes.
  describe("signing out", () => {
    it("makes the token dead on the server, not just forgotten by the client", async () => {
      // Its own session, so signing it out leaves the shared ones alone.
      const admin = await getSession("ADMIN");
      const email = `audit-logout-${uniqueId()}@store.test`;
      const password = `Aa1!${uniqueId()}${uniqueId()}`;

      const created = await apiRequest<{ id: string }>("/api/users", {
        method: "POST",
        token: admin.token,
        body: {
          name: "Audit Logout",
          email,
          password,
          role: "EMPLOYEE",
          phone: `+97059${Math.floor(1000000 + Math.random() * 8999999)}`,
        },
      });
      expect(created.status).toBe(201);

      const signedIn = await rawRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: { email, password },
      });
      const token = signedIn.body?.token as string;
      expect(token).toBeTruthy();

      // The token works...
      expect((await apiRequest("/api/categories", { token })).status).toBe(200);

      const out = await rawRequest("/api/auth/sign-out", { method: "POST", token });
      expect(out.status).toBeLessThan(400);

      // Replaying it is what somebody picking up the shop phone after a shift would do.
      const replayed = await apiRequest("/api/categories", { token });
      expect(replayed.status).toBe(401);
      expect(replayed.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });
  });

  // M1: an unknown body field is refused, one `{ ...body }` away from a mass-assignment hole otherwise.
  describe("a field an endpoint does not accept is refused, not swallowed", () => {
    it.each([
      ["stockDeductedAt", { stockDeductedAt: null }],
      ["collectedAt", { collectedAt: "2020-01-01T00:00:00.000Z" }],
      ["paymentStatus", { paymentStatus: "COLLECTED" }],
      ["status", { status: "COMPLETED" }],
      ["orderNumber", { orderNumber: 1 }],
    ])("refuses %s on an order edit", async (_label, extra) => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/orders/does-not-matter", {
        method: "PATCH",
        token: admin.token,
        body: { note: "a note", ...extra },
      });

      // 400, not 404: validation runs before the lookup, so no real order is needed.
      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
    });

    it("refuses a role smuggled into a user update", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/users/does-not-matter", {
        method: "PATCH",
        token: admin.token,
        body: { name: "New Name", emailVerified: true },
      });

      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
    });

    it("names the offending path, including inside a nested array", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/orders", {
        method: "POST",
        token: admin.token,
        body: {
          channel: "STORE",
          items: [{ productId: "whatever", quantity: 1, unitPrice: "0.01" }],
        },
      });

      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
      const details = res.error?.details as { keys?: string[]; path?: string[] }[] | undefined;
      expect(details?.some((issue) => issue.keys?.includes("unitPrice"))).toBe(true);
      expect(details?.some((issue) => issue.path?.join(".") === "items.0")).toBe(true);
    });

    it("still accepts a body that only carries fields the endpoint declares", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/settings", {
        method: "PATCH",
        token: admin.token,
        body: { lowStockThreshold: 3 },
      });

      expect(res.status).toBe(200);
    });

    it("leaves query strings alone, so a cache-buster is not a 400", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/products?page=1&pageSize=1&_=1699999999", {
        token: admin.token,
      });

      expect(res.status).toBe(200);
    });
  });

  // M3: settings is an allow-list, so a new column never reaches every Employee unasked.
  describe("the settings payload is an allow-list", () => {
    const EXPECTED_FIELDS = [
      "id",
      "storeName",
      "defaultLanguage",
      "supportedLanguages",
      "currency",
      "defaultCountryCode",
      "lowStockThreshold",
      "posAutoLockMinutes",
      "logoUrl",
      "faviconUrls",
      "labelPrintMode",
      "labelWidthMm",
      "labelHeightMm",
      "labelColumns",
      "labelRows",
      "labelPageMarginTopMm",
      "labelPageMarginRightMm",
      "labelPageMarginBottomMm",
      "labelPageMarginLeftMm",
      "labelGapXMm",
      "labelGapYMm",
      "saleNotificationsEnabled",
      "saleNotificationMode",
      "saleNotificationMinAmount",
      "updatedAt",
    ];

    it.each(["ADMIN", "MANAGER", "EMPLOYEE"] as SeededRole[])(
      "returns exactly the named fields to a %s and nothing else",
      async (role) => {
        const session = await getSession(role);
        const res = await apiRequest<Record<string, unknown>>("/api/settings", { token: session.token });

        expect(res.status).toBe(200);
        // Set equality both ways: an unlisted field is the regression, a missing one a screen losing its value.
        expect(Object.keys(res.data!).sort()).toEqual([...EXPECTED_FIELDS].sort());
      },
    );
  });

  // L3: a non-image declared as image/png must be a 400, not a 500 from sharp.
  describe("an upload that is not an image", () => {
    it("is refused as a bad request rather than crashing into a 500", async () => {
      const admin = await getSession("ADMIN");

      // A real product, or the route 404s on the owner before reaching the file.
      const categoryId = await anyCategoryId(admin.token);
      const product = await apiRequest<{ id: string }>("/api/products", {
        method: "POST",
        token: admin.token,
        body: { name: { ar: "اختبار رفع ملف غير صورة" }, categoryId, basePrice: "10" },
      });
      expect(product.status).toBe(201);

      const form = new FormData();
      // A PHP script wearing a PNG's Content-Type: what the declared-mimetype filter waves through.
      form.append("productId", product.data!.id);
      form.append("file", new Blob(["<?php system($_GET['c']); ?>"], { type: "image/png" }), "shell.png");

      const response = await fetch(`${API_BASE_URL}/api/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${admin.token}`, Origin: API_ORIGIN },
        body: form,
      });
      const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe(ERROR_CODES.IMAGE_INVALID_TYPE);
    });
  });

  // L4: losing the last Admin locks the shop out of approvals, Settings, staff and profit for good.
  describe("the last Admin", () => {
    it("cannot be demoted or deactivated while they are the only one", async () => {
      const admin = await getSession("ADMIN");

      const admins = await apiRequest<{ id: string; isActive: boolean }[]>(
        "/api/users?role=ADMIN&isActive=true&pageSize=50",
        { token: admin.token },
      );
      expect(admins.status).toBe(200);

      // The rule applies only with exactly one Admin.
      if ((admins.data ?? []).length !== 1) {
        return;
      }

      // Demoting yourself is USER_LAST_ADMIN; deactivating yourself is USER_SELF_REMOVAL, checked first.
      const demoted = await apiRequest(`/api/users/${admin.userId}`, {
        method: "PATCH",
        token: admin.token,
        body: { role: "MANAGER" },
      });
      expect(demoted.status).toBe(409);
      expect(demoted.error?.code).toBe(ERROR_CODES.USER_LAST_ADMIN);

      const switchedOff = await apiRequest(`/api/users/${admin.userId}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });
      expect(switchedOff.status).toBe(409);
      expect(switchedOff.error?.code).toBe(ERROR_CODES.USER_SELF_REMOVAL);

      // The account is untouched, so the run has not locked itself out.
      const after = await apiRequest<{ role: string; isActive: boolean }>(`/api/users/${admin.userId}`, {
        token: admin.token,
      });
      expect(after.data!.role).toBe("ADMIN");
      expect(after.data!.isActive).toBe(true);
    });
  });
});

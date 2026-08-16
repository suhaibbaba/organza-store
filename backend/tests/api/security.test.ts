// ============================================================================
//  SECURITY REGRESSIONS
//
//  One test per finding from the security audit (SECURITY-AUDIT.md). Each one
//  FAILED before its fix and passes after it, so this file is the thing that
//  would notice any of them coming back.
//
//  They are grouped by what they defend rather than by endpoint, because the
//  endpoint is rarely the point: "nobody can make themselves an account" is a
//  property of the system, and it would be just as broken if it were a
//  different route that let them.
// ============================================================================
import { describe, expect, it } from "vitest";
import { API_BASE_URL, API_ORIGIN, apiRequest, rawRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import { ERROR_CODES } from "@/constants";
import type { SeededRole } from "@tests/types";

describe("Security", () => {
  // --------------------------------------------------------------------------
  // C1 — the critical one. Better Auth's `emailAndPassword.enabled` turns on
  // its whole email+password surface, sign-up included, and `disableSignUp`
  // defaults to false. The endpoint was mounted publicly by
  // `app.all("/api/auth/*")`, so anybody on the internet could POST an email,
  // a password and a phone number and be handed a signed-in EMPLOYEE account
  // — the POS, the catalogue, and every order in the shop with every
  // customer's name and phone number on it.
  // --------------------------------------------------------------------------
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
      // No session, under any spelling — this is the field that used to come
      // back holding a working bearer token.
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
      const email = `audit-staff-${uniqueId()}@organza.test`;

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
      // Created with no password at all (CLAUDE.md rule 17) — no throwaway
      // secret is minted any more, so there is nothing to leak.
      expect(res.data!.hasPassword).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // L1 — Better Auth's own POST /update-user accepts any additionalField
  // declared `input: true`. `idNumber` is Admin-only data (CLAUDE.md rule 19)
  // and `phone` is unique across BOTH Palestine prefixes (rule 18), a rule
  // enforced only by routes/users.ts — so neither is the account owner's to
  // rewrite from a session.
  // --------------------------------------------------------------------------
  describe("staff cannot rewrite their own protected fields", () => {
    it.each(["idNumber", "phone", "whatsapp", "role", "isActive"])(
      "does not let an Employee set their own %s through Better Auth's update-user",
      async (field) => {
        const employee = await getSession("EMPLOYEE");
        const before = await apiRequest<{ role: string }>("/api/users", { token: employee.token });
        // The users list is Admin-only, so an Employee cannot even read it —
        // which is itself the check that matters for `role`.
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

        // Whatever that request did or did not do, the session's role must be
        // unchanged — the one consequence that would actually be a breach.
        const session = await rawRequest("/api/auth/get-session", { token: employee.token });
        expect(session.body?.user?.role).toBe("EMPLOYEE");
        expect(session.body?.user?.idNumber ?? null).not.toBe("999999999");
        expect(session.body?.user?.isActive).toBe(true);
      }
    );
  });

  // --------------------------------------------------------------------------
  // M2 — the admin and POS clients used to clear the local token FIRST and
  // then fire sign-out with its failure swallowed, so an offline logout left
  // a live session on the server for its full week. They now await it (see
  // admin/src/lib/auth/client.ts). This is the half that has to be true for
  // that to be worth anything: that the server really does revoke.
  // --------------------------------------------------------------------------
  describe("signing out", () => {
    it("makes the token dead on the server, not just forgotten by the client", async () => {
      // A session of its own, so signing it out cannot disturb the cached
      // sessions every other test in the run is sharing.
      const admin = await getSession("ADMIN");
      const email = `audit-logout-${uniqueId()}@organza.test`;
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

      // ...and now it does not. Replaying it is what somebody who picked up
      // the shop phone after a shift would be doing.
      const replayed = await apiRequest("/api/categories", { token });
      expect(replayed.status).toBe(401);
      expect(replayed.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });
  });

  // --------------------------------------------------------------------------
  // M1 — Zod strips unknown keys by default, so a body naming its own price,
  // its own approval status or its own timestamps was answered with a 200 and
  // the fields quietly dropped. Safe, but silent, and one `data: { ...body }`
  // away from being a real mass-assignment hole.
  // --------------------------------------------------------------------------
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

      // 400 rather than 404: validation runs before the row is looked up, so
      // this holds without needing a real order to tamper with.
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

  // --------------------------------------------------------------------------
  // M3 — GET /api/settings used to be `{ ...setting }` on a route every
  // signed-in role can read, so the next column added to the model would have
  // reached every Employee with nobody deciding it should.
  // --------------------------------------------------------------------------
  describe("the settings payload is an allow-list", () => {
    const EXPECTED_FIELDS = [
      "id",
      "storeName",
      "defaultLanguage",
      "supportedLanguages",
      "currency",
      "defaultCountryCode",
      "lowStockThreshold",
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
        // Set equality both ways: a field that appears without being added
        // here is the regression this guards, and one that disappears is a
        // screen that has quietly lost a value it reads.
        expect(Object.keys(res.data!).sort()).toEqual([...EXPECTED_FIELDS].sort());
      }
    );
  });

  // --------------------------------------------------------------------------
  // L3 — the multer filter checks the client-declared Content-Type, so a
  // non-image announced as image/png reached sharp and threw: HTTP 500,
  // error.internal, and a Sentry event, for what is a bad request.
  // --------------------------------------------------------------------------
  describe("an upload that is not an image", () => {
    it("is refused as a bad request rather than crashing into a 500", async () => {
      const admin = await getSession("ADMIN");

      // A REAL product, because the route resolves the owner before it ever
      // reaches the file — without one this would 404 on the product and
      // prove nothing about the upload.
      const categoryId = await anyCategoryId(admin.token);
      const product = await apiRequest<{ id: string }>("/api/products", {
        method: "POST",
        token: admin.token,
        body: { name: { ar: "اختبار رفع ملف غير صورة" }, categoryId, basePrice: "10" },
      });
      expect(product.status).toBe(201);

      const form = new FormData();
      // A PHP script wearing a PNG's Content-Type — exactly what the
      // declared-mimetype filter waves through, and what used to reach sharp
      // and come back out as a 500 with a Sentry event attached.
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

  // --------------------------------------------------------------------------
  // L4 — demoting or deactivating the last Admin locks the door from the
  // outside: nobody can then approve a change, reach Settings, manage staff or
  // see profit, and nothing in the app can put it back.
  // --------------------------------------------------------------------------
  describe("the last Admin", () => {
    it("cannot be demoted or deactivated while they are the only one", async () => {
      const admin = await getSession("ADMIN");

      const admins = await apiRequest<{ id: string; isActive: boolean }[]>(
        "/api/users?role=ADMIN&isActive=true&pageSize=50",
        { token: admin.token }
      );
      expect(admins.status).toBe(200);

      // The seeded database has exactly one Admin; if a run ever has more,
      // the rule genuinely does not apply and there is nothing to assert.
      if ((admins.data ?? []).length !== 1) return;

      for (const body of [{ role: "MANAGER" }, { isActive: false }]) {
        const res = await apiRequest(`/api/users/${admin.userId}`, {
          method: "PATCH",
          token: admin.token,
          body,
        });
        expect(res.status).toBe(409);
        expect(res.error?.code).toBe(ERROR_CODES.USER_LAST_ADMIN);
      }

      // ...and the account is untouched, so the run that just tried has not
      // locked itself out.
      const after = await apiRequest<{ role: string; isActive: boolean }>(`/api/users/${admin.userId}`, {
        token: admin.token,
      });
      expect(after.data!.role).toBe("ADMIN");
      expect(after.data!.isActive).toBe(true);
    });
  });
});

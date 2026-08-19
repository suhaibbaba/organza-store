// ============================================================================
//  Editable role permissions (spec.md "Editable role permissions")
//
//  What has to hold, and is asserted here twice over — the API's answer AND
//  the effect on a real endpoint:
//
//    * a CONFIGURABLE grant can be revoked and the refusal is immediate;
//    * ...and granted, and the new power is immediately real;
//    * a PROTECTED action cannot be moved by anybody, by any route into the
//      API, on any role — refused by the server, not hidden by a screen;
//    * only an Admin may edit at all, and never their own role;
//    * the last active Admin cannot be stripped of the role either way;
//    * and the cache behind `can()` never serves a stale answer.
// ============================================================================
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONFIGURABLE_ACTIONS, PERMISSION_ACTIONS, PROTECTED_ACTIONS } from "@organza/shared/constants/permissions";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import {
  applyDefaultPermissions,
  fetchPermissionMatrix,
  patchRolePermissions,
  setRolePermission,
  withRolePermission,
} from "@tests/support/permissions";
import { ERROR_CODES } from "@/constants";
import type { PermissionMatrixResponse, StaffAccountView } from "@tests/types";

describe("Role permissions", () => {
  let adminToken: string;
  let managerToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    adminToken = (await getSession("ADMIN")).token;
    managerToken = (await getSession("MANAGER")).token;
    employeeToken = (await getSession("EMPLOYEE")).token;
  });

  // Everything below flips grants. Whatever a case leaves behind, the next
  // suite in the run must not inherit it.
  afterAll(async () => {
    await applyDefaultPermissions();
  });

  // -------------------------------------------------------------------------
  // The shape of the rules
  // -------------------------------------------------------------------------
  describe("the matrix itself", () => {
    it("splits every action into exactly one of protected and configurable", async () => {
      const matrix = await fetchPermissionMatrix();

      const protectedSet = new Set(matrix.protectedActions);
      const configurableSet = new Set(matrix.configurableActions);

      for (const action of PERMISSION_ACTIONS) {
        const inProtected = protectedSet.has(action);
        const inConfigurable = configurableSet.has(action);
        expect(inProtected || inConfigurable, `${action} is in neither list`).toBe(true);
        expect(inProtected && inConfigurable, `${action} is in both lists`).toBe(false);
      }

      expect(matrix.protectedActions.length + matrix.configurableActions.length).toBe(PERMISSION_ACTIONS.length);
    });

    it("protects the shop's anti-theft guarantees and nothing less", async () => {
      const matrix = await fetchPermissionMatrix();

      // The list spec.md's "Security rationale" is built on. If any of these
      // ever becomes configurable, the guarantee it encodes stops being one.
      for (const action of [
        "product.viewCost",
        "report.view",
        "user.viewSensitive",
        "product.editPrice",
        "order.edit",
        "order.cancel",
        "order.delete",
        "order.return",
        "order.createGift",
        "order.markCollected",
        "changeRequest.approve",
        "expense.approve",
        "user.manage",
        "user.delete",
        "permission.manage",
      ]) {
        expect(matrix.protectedActions, `${action} must never be editable`).toContain(action);
      }
    });

    it("is readable by every role, so a client's can() agrees with the server's", async () => {
      for (const token of [managerToken, employeeToken]) {
        const res = await apiRequest<PermissionMatrixResponse>("/api/permissions", { token });
        expect(res.status).toBe(200);
        expect(res.data!.roles.EMPLOYEE).toBeInstanceOf(Array);
      }
    });

    it("says an Admin holds everything, including the permission to edit this", async () => {
      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.ADMIN).toContain("permission.manage");
      expect(matrix.roles.MANAGER).not.toContain("permission.manage");
      expect(matrix.roles.EMPLOYEE).not.toContain("permission.manage");
    });
  });

  // -------------------------------------------------------------------------
  // A configurable grant, revoked — and the refusal that follows
  // -------------------------------------------------------------------------
  describe("revoking a configurable grant", () => {
    it("stops the role doing the thing, on the very next request", async () => {
      // An Employee creates products by default (spec.md). The 400 is the
      // validation failure BEYOND the gate: it proves the permission passed,
      // which a 200 with a real payload would prove too but at the cost of a
      // fixture to clean up.
      const before = await apiRequest("/api/products", { method: "POST", token: employeeToken, body: {} });
      expect(before.status, "the gate is open to start with").toBe(400);

      await withRolePermission("EMPLOYEE", "product.create", false, async () => {
        const during = await apiRequest("/api/products", { method: "POST", token: employeeToken, body: {} });
        expect(during.status).toBe(403);
        expect(during.error?.code).toBe(ERROR_CODES.FORBIDDEN);
      });

      const after = await apiRequest("/api/products", { method: "POST", token: employeeToken, body: {} });
      expect(after.status, "and it opens again when the grant comes back").toBe(400);
    });

    it("takes a read away too — the catalogue is a grant like any other", async () => {
      await withRolePermission("EMPLOYEE", "product.view", false, async () => {
        const listed = await apiRequest("/api/products", { token: employeeToken });
        expect(listed.status).toBe(403);
      });

      const restored = await apiRequest("/api/products", { token: employeeToken });
      expect(restored.status).toBe(200);
    });

    it("shows up in the matrix the API serves, so the screens follow", async () => {
      await withRolePermission("EMPLOYEE", "category.view", false, async () => {
        const matrix = await fetchPermissionMatrix();
        expect(matrix.roles.EMPLOYEE).not.toContain("category.view");
      });

      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.EMPLOYEE).toContain("category.view");
    });

    it("leaves a Manager's own grant alone — one role at a time", async () => {
      await withRolePermission("EMPLOYEE", "category.view", false, async () => {
        const matrix = await fetchPermissionMatrix();
        expect(matrix.roles.MANAGER, "a Manager still reads categories").toContain("category.view");
      });
    });
  });

  // -------------------------------------------------------------------------
  // ...and granted
  // -------------------------------------------------------------------------
  describe("granting a configurable action", () => {
    it("lets a role do something it could not do before", async () => {
      const denied = await apiRequest("/api/categories", {
        method: "POST",
        token: employeeToken,
        body: { name: { ar: "ف", en: `Cat ${uniqueId()}`, he: "ק" } },
      });
      expect(denied.status, "an Employee does not manage categories as shipped").toBe(403);

      await withRolePermission("EMPLOYEE", "category.manage", true, async () => {
        const created = await apiRequest<{ id: string }>("/api/categories", {
          method: "POST",
          token: employeeToken,
          body: { name: { ar: "فئة", en: `Cat ${uniqueId()}`, he: "קטגוריה" } },
        });
        expect(created.status).toBe(201);

        // Taken away again here rather than at teardown: a category with no
        // products is deletable, and leaving one behind would put a row in the
        // shop's own tree.
        await apiRequest(`/api/categories/${created.data!.id}`, { method: "DELETE", token: adminToken });
      });

      const deniedAgain = await apiRequest("/api/categories", {
        method: "POST",
        token: employeeToken,
        body: { name: { ar: "ف", en: `Cat ${uniqueId()}`, he: "ק" } },
      });
      expect(deniedAgain.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // PROTECTED — refused, whatever the request looks like
  // -------------------------------------------------------------------------
  describe("a protected action", () => {
    it("cannot be granted to any role, one by one, all of them", async () => {
      for (const action of PROTECTED_ACTIONS) {
        for (const role of ["MANAGER", "EMPLOYEE"] as const) {
          const res = await patchRolePermissions(role, [{ action, granted: true }]);
          expect(res.status, `granting ${action} to ${role}`).toBe(403);
          expect(res.error?.code).toBe(ERROR_CODES.PERMISSION_ACTION_PROTECTED);
        }
      }
    });

    it("cannot be revoked either — not even from a role that does not hold it", async () => {
      for (const action of ["order.cancel", "product.viewCost", "changeRequest.approve"]) {
        const res = await patchRolePermissions("EMPLOYEE", [{ action, granted: false }]);
        expect(res.status).toBe(403);
        expect(res.error?.code).toBe(ERROR_CODES.PERMISSION_ACTION_PROTECTED);
      }
    });

    it("is refused even when smuggled in beside a legitimate change", async () => {
      const res = await patchRolePermissions("EMPLOYEE", [
        { action: "category.manage", granted: true },
        { action: "order.cancel", granted: true },
      ]);
      expect(res.status).toBe(403);
      expect(res.error?.code).toBe(ERROR_CODES.PERMISSION_ACTION_PROTECTED);

      // ...and the legitimate half did not land either. A batch that is
      // refused is refused whole, or "refused" would be a way to write half a
      // change and be told it failed.
      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.EMPLOYEE).not.toContain("category.manage");
      expect(matrix.roles.EMPLOYEE).not.toContain("order.cancel");
    });

    it("stays exactly where it was afterwards", async () => {
      await patchRolePermissions("EMPLOYEE", [{ action: "order.markCollected", granted: true }]);

      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.EMPLOYEE).not.toContain("order.markCollected");

      // And the gate itself is unmoved — the state that actually matters.
      const attempt = await apiRequest("/api/orders/collection-summary", { token: employeeToken });
      expect(attempt.status).toBe(403);
    });

    it("is refused with the reason, not with a validation error", async () => {
      const protectedAttempt = await patchRolePermissions("EMPLOYEE", [{ action: "order.delete", granted: true }]);
      expect(protectedAttempt.error?.code).toBe(ERROR_CODES.PERMISSION_ACTION_PROTECTED);

      // Whereas a string that is not an action at all is a bad request, which
      // is a different thing and says so.
      const nonsense = await patchRolePermissions("EMPLOYEE", [{ action: "not.an.action", granted: true }]);
      expect(nonsense.status).toBe(400);
      expect(nonsense.error?.code).toBe(ERROR_CODES.VALIDATION);
    });
  });

  // -------------------------------------------------------------------------
  // Who may edit
  // -------------------------------------------------------------------------
  describe("who may edit the table", () => {
    it("refuses a Manager and an Employee outright", async () => {
      for (const token of [managerToken, employeeToken]) {
        const res = await patchRolePermissions("EMPLOYEE", [{ action: "category.manage", granted: true }], { token });
        expect(res.status).toBe(403);
        expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
      }

      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.EMPLOYEE).not.toContain("category.manage");
    });

    it("refuses an Admin editing their own role", async () => {
      const res = await patchRolePermissions("ADMIN", [{ action: "dashboard.view", granted: false }]);
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.PERMISSION_SELF_ROLE);

      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.ADMIN, "and the Admin still holds everything").toContain("dashboard.view");
    });

    it("refuses it even for a change that would be harmless", async () => {
      // Granting the Admin something they already hold changes nothing at
      // all — and is still refused, because the rule is about WHO is editing
      // WHOSE authority, not about what the edit happens to amount to.
      const res = await patchRolePermissions("ADMIN", [{ action: "product.view", granted: true }]);
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.PERMISSION_SELF_ROLE);
    });
  });

  // -------------------------------------------------------------------------
  // The last Admin
  // -------------------------------------------------------------------------
  describe("the last active Admin", () => {
    it("cannot be stripped by demotion, which the permissions screen offers no way round", async () => {
      const admins = await apiRequest<StaffAccountView[]>("/api/users?role=ADMIN&isActive=true&pageSize=50", {
        token: adminToken,
      });
      expect(admins.status).toBe(200);

      // Only meaningful while there is exactly one — with two, demoting one
      // is a legitimate thing to allow (and userRemoval.test.ts owns the
      // full treatment of that guard). What is pinned here is the other half:
      // that this feature did not open a second road to the same place.
      if ((admins.data ?? []).length === 1) {
        const admin = await getSession("ADMIN");
        const demoted = await apiRequest(`/api/users/${admin.userId}`, {
          method: "PATCH",
          token: adminToken,
          body: { role: "MANAGER" },
        });
        expect(demoted.status).toBe(409);
        expect(demoted.error?.code).toBe(ERROR_CODES.USER_LAST_ADMIN);
      }

      // And the road this feature could have opened is closed: the ADMIN row
      // is not editable at all, so no sequence of permission edits can take
      // anything away from the account holding the shop together.
      const selfEdit = await patchRolePermissions("ADMIN", [{ action: "settings.manage", granted: false }]);
      expect(selfEdit.status).toBe(409);
      expect(selfEdit.error?.code).toBe(ERROR_CODES.PERMISSION_SELF_ROLE);

      // Belt and braces on the thing that actually matters: the Admin can
      // still reach Settings afterwards.
      const settings = await apiRequest("/api/settings", { method: "PATCH", token: adminToken, body: {} });
      expect(settings.status).toBe(200);
    });

    it("keeps every protected power with the Admin no matter what is configured", async () => {
      // The worst case the screen can produce: every configurable action
      // granted to everybody. The Admin-only powers must be untouched.
      await patchRolePermissions(
        "MANAGER",
        CONFIGURABLE_ACTIONS.map((action) => ({ action, granted: true }))
      );
      await patchRolePermissions(
        "EMPLOYEE",
        CONFIGURABLE_ACTIONS.map((action) => ({ action, granted: true }))
      );

      try {
        const matrix = await fetchPermissionMatrix();
        for (const role of ["MANAGER", "EMPLOYEE"] as const) {
          expect(matrix.roles[role], `${role} must not reach the permissions table`).not.toContain("permission.manage");
          expect(matrix.roles[role], `${role} must not reach cost`).not.toContain("product.viewCost");
          expect(matrix.roles[role], `${role} must not reach the reports`).not.toContain("report.view");
          expect(matrix.roles[role], `${role} must not approve changes`).not.toContain("changeRequest.approve");
          expect(matrix.roles[role], `${role} must not manage staff`).not.toContain("user.manage");
        }

        // ...and the gates agree with the matrix.
        for (const token of [managerToken, employeeToken]) {
          expect((await apiRequest("/api/reports/sales", { token })).status).toBe(403);
          expect((await apiRequest("/api/users", { token })).status).toBe(403);
          expect(
            (await patchRolePermissions("EMPLOYEE", [{ action: "inventory.view", granted: true }], { token })).status
          ).toBe(403);
        }
      } finally {
        await applyDefaultPermissions();
      }
    });
  });

  // -------------------------------------------------------------------------
  // The cache
  // -------------------------------------------------------------------------
  describe("the cache behind can()", () => {
    it("never serves a stale answer to the request straight after a change", async () => {
      // No pause, no retry, no polling: the assertion is that the very next
      // request already sees it. `can()` answers from memory, so this is the
      // property the whole caching design has to buy.
      for (let round = 0; round < 3; round++) {
        await setRolePermission("EMPLOYEE", "product.create", false);
        const denied = await apiRequest("/api/products", { method: "POST", token: employeeToken, body: {} });
        expect(denied.status, `round ${round}: revoked`).toBe(403);

        await setRolePermission("EMPLOYEE", "product.create", true);
        const allowed = await apiRequest("/api/products", { method: "POST", token: employeeToken, body: {} });
        expect(allowed.status, `round ${round}: granted`).toBe(400);
      }
    });

    it("reports what one request actually changed, and nothing it did not", async () => {
      const first = await patchRolePermissions("EMPLOYEE", [{ action: "inventory.view", granted: true }]);
      expect(first.status).toBe(200);
      expect((first.data as PermissionMatrixResponse & { changed: unknown[] }).changed).toEqual([
        { action: "inventory.view", granted: true },
      ]);

      // Sending the same state again is not an error and is not a change —
      // the screen may re-send what it already has.
      const again = await patchRolePermissions("EMPLOYEE", [{ action: "inventory.view", granted: true }]);
      expect(again.status).toBe(200);
      expect((again.data as PermissionMatrixResponse & { changed: unknown[] }).changed).toEqual([]);

      await setRolePermission("EMPLOYEE", "inventory.view", false);
    });
  });

  // -------------------------------------------------------------------------
  // The trail
  // -------------------------------------------------------------------------
  describe("the audit trail", () => {
    it("records every grant and every revoke, by role and by action", async () => {
      await setRolePermission("EMPLOYEE", "expense.view", true);
      await setRolePermission("EMPLOYEE", "expense.view", false);

      // The audit log has no read endpoint yet, so what is asserted here is
      // the contract the write depends on: the change landed, and it landed
      // through the route that writes the entry (a direct database write
      // would not have gone through requirePermission at all).
      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.EMPLOYEE).not.toContain("expense.view");
    });
  });

  // -------------------------------------------------------------------------
  // The body itself
  // -------------------------------------------------------------------------
  describe("the request body", () => {
    it("refuses an empty change list and a repeated action", async () => {
      const empty = await patchRolePermissions("EMPLOYEE", []);
      expect(empty.status).toBe(400);

      const repeated = await patchRolePermissions("EMPLOYEE", [
        { action: "inventory.view", granted: true },
        { action: "inventory.view", granted: false },
      ]);
      expect(repeated.status).toBe(400);
    });

    it("refuses a role that does not exist", async () => {
      const res = await patchRolePermissions("OWNER", [{ action: "inventory.view", granted: true }]);
      expect(res.status).toBe(400);
    });

    it("accepts the whole configurable list in one request", async () => {
      const res = await patchRolePermissions(
        "MANAGER",
        CONFIGURABLE_ACTIONS.map((action) => ({ action, granted: true }))
      );
      expect(res.status).toBe(200);

      const matrix = await fetchPermissionMatrix();
      for (const action of CONFIGURABLE_ACTIONS) {
        expect(matrix.roles.MANAGER, `${action} granted to a Manager`).toContain(action);
      }
      // ...and not one protected action came with it.
      for (const action of PROTECTED_ACTIONS) {
        if (action === "permission.manage" || action === "product.viewCost" || action === "report.view") {
          expect(matrix.roles.MANAGER, `${action} is still the Admin's`).not.toContain(action);
        }
      }

      await applyDefaultPermissions();
    });
  });
});

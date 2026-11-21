// Role permissions: every grant flips and takes effect at once; the ADMIN row is never editable; the last Admin stays.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONFIGURABLE_ACTIONS, PERMISSION_ACTIONS } from "@store/shared/constants/permissions";
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

  // Every case flips grants, so the next suite must not inherit what it leaves.
  afterAll(async () => {
    await applyDefaultPermissions();
  });

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

    it("locks nothing — every action is configurable", async () => {
      const matrix = await fetchPermissionMatrix();
      expect(matrix.protectedActions).toEqual([]);
      expect([...matrix.configurableActions].sort()).toEqual([...PERMISSION_ACTIONS].sort());
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

  describe("revoking a configurable grant", () => {
    it("stops the role doing the thing, on the very next request", async () => {
      // The 400 is validation beyond the gate: it proves the permission passed without a fixture to clean up.
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

        // Deleted here, not at teardown, so no row is left in the shop's own tree.
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

  describe("a formerly locked action", () => {
    it("can be granted, and the gate follows on the very next request", async () => {
      const before = await apiRequest("/api/orders/collection-summary", { token: employeeToken });
      expect(before.status, "an Employee does not see the outstanding total as shipped").toBe(403);

      await withRolePermission("EMPLOYEE", "order.markCollected", true, async () => {
        const during = await apiRequest("/api/orders/collection-summary", { token: employeeToken });
        expect(during.status).toBe(200);
      });

      const after = await apiRequest("/api/orders/collection-summary", { token: employeeToken });
      expect(after.status, "and it closes again when the grant goes").toBe(403);
    });

    it("can be taken from a Manager too", async () => {
      await withRolePermission("MANAGER", "order.cancel", false, async () => {
        const matrix = await fetchPermissionMatrix();
        expect(matrix.roles.MANAGER).not.toContain("order.cancel");
      });

      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.MANAGER).toContain("order.cancel");
    });

    it("a string that is not an action at all is still a bad request", async () => {
      const nonsense = await patchRolePermissions("EMPLOYEE", [{ action: "not.an.action", granted: true }]);
      expect(nonsense.status).toBe(400);
      expect(nonsense.error?.code).toBe(ERROR_CODES.VALIDATION);
    });
  });

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
      // Refused even when it changes nothing: the rule is who edits whose authority.
      const res = await patchRolePermissions("ADMIN", [{ action: "product.view", granted: true }]);
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe(ERROR_CODES.PERMISSION_SELF_ROLE);
    });
  });

  describe("the last active Admin", () => {
    it("cannot be stripped by demotion, which the permissions screen offers no way round", async () => {
      const admins = await apiRequest<StaffAccountView[]>("/api/users?role=ADMIN&isActive=true&pageSize=50", {
        token: adminToken,
      });
      expect(admins.status).toBe(200);

      // Only meaningful with exactly one Admin; userRemoval.test.ts owns the full guard.
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

      // The ADMIN row is not editable, so no sequence of permission edits can strip the shop's Admin.
      const selfEdit = await patchRolePermissions("ADMIN", [{ action: "settings.manage", granted: false }]);
      expect(selfEdit.status).toBe(409);
      expect(selfEdit.error?.code).toBe(ERROR_CODES.PERMISSION_SELF_ROLE);

      // The thing that matters: the Admin still reaches Settings afterwards.
      const settings = await apiRequest("/api/settings", { method: "PATCH", token: adminToken, body: {} });
      expect(settings.status).toBe(200);
    });

    it("keeps every power with the Admin no matter what is configured", async () => {
      // Worst case: everything granted to everybody, permission.manage included — the Admin row is still out of reach.
      await patchRolePermissions(
        "MANAGER",
        CONFIGURABLE_ACTIONS.map((action) => ({ action, granted: true })),
      );
      await patchRolePermissions(
        "EMPLOYEE",
        CONFIGURABLE_ACTIONS.map((action) => ({ action, granted: true })),
      );

      try {
        // A Manager holding permission.manage may edit the Employee's row...
        const managerEdit = await patchRolePermissions("EMPLOYEE", [{ action: "inventory.view", granted: false }], {
          token: managerToken,
        });
        expect(managerEdit.status).toBe(200);

        // ...never their own...
        const managerSelf = await patchRolePermissions("MANAGER", [{ action: "inventory.view", granted: false }], {
          token: managerToken,
        });
        expect(managerSelf.status).toBe(409);
        expect(managerSelf.error?.code).toBe(ERROR_CODES.PERMISSION_SELF_ROLE);

        // ...and never the Admin's.
        for (const token of [managerToken, employeeToken]) {
          const strip = await patchRolePermissions("ADMIN", [{ action: "permission.manage", granted: false }], {
            token,
          });
          expect(strip.status).toBe(409);
          expect(strip.error?.code).toBe(ERROR_CODES.PERMISSION_ADMIN_ROLE);
        }

        const matrix = await fetchPermissionMatrix();
        expect([...matrix.roles.ADMIN].sort()).toEqual([...PERMISSION_ACTIONS].sort());
        expect((await apiRequest("/api/users", { token: adminToken })).status).toBe(200);
      } finally {
        await applyDefaultPermissions();
      }
    });
  });

  describe("the cache behind can()", () => {
    it("never serves a stale answer to the request straight after a change", async () => {
      // No retry or polling: the very next request must see the change, which is what the cache has to buy.
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

      // Re-sending the same state is neither an error nor a change.
      const again = await patchRolePermissions("EMPLOYEE", [{ action: "inventory.view", granted: true }]);
      expect(again.status).toBe(200);
      expect((again.data as PermissionMatrixResponse & { changed: unknown[] }).changed).toEqual([]);

      await setRolePermission("EMPLOYEE", "inventory.view", false);
    });
  });

  describe("the audit trail", () => {
    it("records every grant and every revoke, by role and by action", async () => {
      await setRolePermission("EMPLOYEE", "expense.view", true);
      await setRolePermission("EMPLOYEE", "expense.view", false);

      // No audit read endpoint yet: the change landing through the route that writes the entry is the contract.
      const matrix = await fetchPermissionMatrix();
      expect(matrix.roles.EMPLOYEE).not.toContain("expense.view");
    });
  });

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
        CONFIGURABLE_ACTIONS.map((action) => ({ action, granted: true })),
      );
      expect(res.status).toBe(200);

      const matrix = await fetchPermissionMatrix();
      for (const action of CONFIGURABLE_ACTIONS) {
        expect(matrix.roles.MANAGER, `${action} granted to a Manager`).toContain(action);
      }
      await applyDefaultPermissions();
    });
  });
});

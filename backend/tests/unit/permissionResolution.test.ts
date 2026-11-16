// How `can()` decides, now that half the rules live in a database.
//
// The API suite proves the endpoints behave; this proves the RESOLVER does,
// including the cases an HTTP test cannot reach — a stored row for the
// ADMIN role, a row for an action that does not exist, a role with no stored
// config at all.
import { afterEach, describe, expect, it } from "vitest";
import {
  can,
  getConfigurablePermissions,
  isConfigurableAction,
  isProtectedAction,
  sanitizeConfigurableMatrix,
  setConfigurablePermissions,
} from "@organza/shared/lib/permissions";
import {
  CONFIGURABLE_ACTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_ACTIONS,
  PROTECTED_ACTIONS,
} from "@organza/shared/constants/permissions";
import { ROLES } from "@organza/shared/constants/roles";

afterEach(() => {
  setConfigurablePermissions(null);
});

describe("the protected / configurable split", () => {
  it("covers every action exactly once", () => {
    for (const action of PERMISSION_ACTIONS) {
      expect(isProtectedAction(action) !== isConfigurableAction(action), `${action}`).toBe(true);
    }
    expect(PROTECTED_ACTIONS.length + CONFIGURABLE_ACTIONS.length).toBe(PERMISSION_ACTIONS.length);
  });

  it("locks nothing — every action is configurable", () => {
    expect(PROTECTED_ACTIONS).toEqual([]);
    expect([...CONFIGURABLE_ACTIONS]).toEqual([...PERMISSION_ACTIONS]);
  });

  it("names nothing that is not an action", () => {
    for (const action of PROTECTED_ACTIONS as readonly string[]) {
      expect(PERMISSION_ACTIONS as readonly string[]).toContain(action);
    }
  });

  it("does not treat an unknown string as configurable", () => {
    expect(isConfigurableAction("product.createEverything")).toBe(false);
    expect(isProtectedAction("product.createEverything")).toBe(false);
  });
});

describe("can()", () => {
  it("lets the shop hand out what used to be locked", () => {
    // Every action is configurable now — the money ones included.
    setConfigurablePermissions({
      EMPLOYEE: { "order.cancel": true, "product.viewCost": true, "permission.manage": true },
    });

    expect(can({ role: "EMPLOYEE" }, "order.cancel")).toBe(true);
    expect(can({ role: "EMPLOYEE" }, "product.viewCost")).toBe(true);
    expect(can({ role: "EMPLOYEE" }, "permission.manage")).toBe(true);
  });

  it("answers the ADMIN role from the shipped table, whatever is stored", () => {
    // A row that should not exist, does, and says no. It changes nothing: an
    // Admin holds everything, always.
    setConfigurablePermissions({
      ADMIN: { "order.cancel": false, "user.manage": false, "permission.manage": false },
    });

    for (const action of PERMISSION_ACTIONS) {
      expect(can({ role: "ADMIN" }, action), action).toBe(true);
    }
  });

  it("answers a configurable action from what is stored", () => {
    setConfigurablePermissions({ EMPLOYEE: { "inventory.adjust": true, "product.create": false } });

    expect(can({ role: "EMPLOYEE" }, "inventory.adjust"), "granted").toBe(true);
    expect(can({ role: "EMPLOYEE" }, "product.create"), "revoked").toBe(false);
  });

  it("falls back to the default for an action nobody has decided", () => {
    // A database bootstrapped before the action existed: a row for the role,
    // no row for this action. "Missing" must mean "as shipped", not "no".
    setConfigurablePermissions({ EMPLOYEE: { "inventory.adjust": true } });

    expect(can({ role: "EMPLOYEE" }, "product.create"), "still held").toBe(true);
    expect(can({ role: "EMPLOYEE" }, "category.manage"), "still not held").toBe(false);
  });

  it("falls back for a role with no stored config at all", () => {
    setConfigurablePermissions({ EMPLOYEE: { "inventory.adjust": true } });

    for (const action of CONFIGURABLE_ACTIONS) {
      expect(can({ role: "MANAGER" }, action), `MANAGER / ${action}`).toBe(
        DEFAULT_ROLE_PERMISSIONS.MANAGER.includes(action)
      );
    }
  });

  it("refuses everything to nobody", () => {
    for (const action of PERMISSION_ACTIONS) {
      expect(can(null, action)).toBe(false);
      expect(can(undefined, action)).toBe(false);
    }
  });

  it("refuses everything to a role it has never heard of", () => {
    for (const action of PERMISSION_ACTIONS) {
      expect(can({ role: "OWNER" }, action)).toBe(false);
    }
  });

  it("reproduces the shipped rules exactly when nothing is stored", () => {
    setConfigurablePermissions(null);
    for (const role of ROLES) {
      for (const action of PERMISSION_ACTIONS) {
        expect(can({ role }, action), `${role} / ${action}`).toBe(DEFAULT_ROLE_PERMISSIONS[role].includes(action));
      }
    }
  });
});

describe("sanitizeConfigurableMatrix", () => {
  it("drops the ADMIN row, unknown actions and unknown roles", () => {
    const cleaned = sanitizeConfigurableMatrix({
      ADMIN: { "inventory.adjust": false },
      EMPLOYEE: { "inventory.adjust": true, "order.cancel": true, "not.an.action": true } as never,
      OWNER: { "inventory.adjust": true },
    } as never);

    expect(cleaned.EMPLOYEE).toEqual({ "inventory.adjust": true, "order.cancel": true });
    expect(cleaned.ADMIN).toBeUndefined();
    expect((cleaned as Record<string, unknown>).OWNER).toBeUndefined();
  });

  it("is what setConfigurablePermissions stores, so nothing unsanitized is ever in force", () => {
    setConfigurablePermissions({
      ADMIN: { "images.delete": false },
      EMPLOYEE: { "order.delete": true, "not.an.action": true } as never,
    });

    expect(getConfigurablePermissions()?.EMPLOYEE).toEqual({ "order.delete": true });
    expect(getConfigurablePermissions()?.ADMIN).toBeUndefined();
  });
});

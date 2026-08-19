// How `can()` decides, now that half the rules live in a database.
//
// The API suite proves the endpoints behave; this proves the RESOLVER does,
// including the cases an HTTP test cannot reach — a stored row for a
// protected action, a row for an action that does not exist, a role with no
// stored config at all.
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

  it("names nothing that is not an action", () => {
    for (const action of PROTECTED_ACTIONS) {
      expect(PERMISSION_ACTIONS as readonly string[]).toContain(action);
    }
  });

  it("does not treat an unknown string as configurable", () => {
    expect(isConfigurableAction("product.createEverything")).toBe(false);
    expect(isProtectedAction("product.createEverything")).toBe(false);
  });
});

describe("can()", () => {
  it("answers a protected action from the shipped table, whatever is stored", () => {
    // The strongest form of the guarantee: a row that should not exist, does,
    // and says yes. It changes nothing.
    setConfigurablePermissions({
      EMPLOYEE: { "order.cancel": true, "product.viewCost": true, "permission.manage": true } as never,
    });

    expect(can({ role: "EMPLOYEE" }, "order.cancel")).toBe(false);
    expect(can({ role: "EMPLOYEE" }, "product.viewCost")).toBe(false);
    expect(can({ role: "EMPLOYEE" }, "permission.manage")).toBe(false);
    expect(can({ role: "ADMIN" }, "order.cancel")).toBe(true);
  });

  it("cannot have a protected action taken away either", () => {
    setConfigurablePermissions({ ADMIN: { "order.cancel": false, "user.manage": false } as never });

    expect(can({ role: "ADMIN" }, "order.cancel")).toBe(true);
    expect(can({ role: "ADMIN" }, "user.manage")).toBe(true);
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
  it("drops protected actions, unknown actions and unknown roles", () => {
    const cleaned = sanitizeConfigurableMatrix({
      EMPLOYEE: { "inventory.adjust": true, "order.cancel": true, "not.an.action": true } as never,
      OWNER: { "inventory.adjust": true },
    } as never);

    expect(cleaned.EMPLOYEE).toEqual({ "inventory.adjust": true });
    expect((cleaned as Record<string, unknown>).OWNER).toBeUndefined();
  });

  it("is what setConfigurablePermissions stores, so nothing unsanitized is ever in force", () => {
    setConfigurablePermissions({ EMPLOYEE: { "order.delete": true, "images.delete": true } as never });

    expect(getConfigurablePermissions()?.EMPLOYEE).toEqual({ "images.delete": true });
  });
});

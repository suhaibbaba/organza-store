// Each role lands on a route it may open.
import { describe, expect, it } from "vitest";
import { can } from "@store/shared/lib/permissions";
import type { Role } from "@store/shared/types/role";
import { NAV_ITEMS } from "@/constants/nav";
import { DEFAULT_LANDING_HREF } from "@/constants/routes";
import { landingHref } from "@/lib/nav";

const ROLES: Role[] = ["ADMIN", "MANAGER", "EMPLOYEE"];

/** What the nav would put on screen for this role — the app's own answer. */
function allowedHrefs(role: Role): string[] {
  return NAV_ITEMS.filter((item) => can({ role }, item.action)).map((item) => item.href);
}

describe("Landing after sign-in", () => {
  for (const role of ROLES) {
    it(`sends a ${role} to a screen they are allowed to open`, () => {
      const target = landingHref({ role });

      expect(target).not.toBeNull();
      expect(allowedHrefs(role)).toContain(target);
    });
  }

  it("does not send an Employee to the dashboard", () => {
    // The regression: every sign-in went to the Admin/Manager-only dashboard.
    expect(landingHref({ role: "EMPLOYEE" })).not.toBe(DEFAULT_LANDING_HREF);
    expect(allowedHrefs("EMPLOYEE")).not.toContain(DEFAULT_LANDING_HREF);
  });

  it("still starts an Admin and a Manager on the dashboard", () => {
    expect(landingHref({ role: "ADMIN" })).toBe(DEFAULT_LANDING_HREF);
    expect(landingHref({ role: "MANAGER" })).toBe(DEFAULT_LANDING_HREF);
  });

  it("has nowhere to send somebody who may open nothing, and says so", () => {
    // Permissions are editable per shop; null makes RoleGuard explain instead of looping.
    expect(landingHref(null)).toBeNull();
  });
});

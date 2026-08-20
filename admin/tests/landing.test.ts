// WHERE EACH ROLE'S MORNING STARTS.
//
// Everybody used to be sent to /dashboard after signing in, and the dashboard
// became Admin/Manager only — so an Employee's first screen of the day was one
// they are refused, redirected a frame later by the guard. This pins the rule
// that replaced it: the route somebody lands on is one they may actually open.
import { describe, expect, it } from "vitest";
import { can } from "@organza/shared/lib/permissions";
import type { Role } from "@organza/shared/types/role";
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
    // The specific regression: the dashboard is Admin/Manager only, and it was
    // where every sign-in went.
    expect(landingHref({ role: "EMPLOYEE" })).not.toBe(DEFAULT_LANDING_HREF);
    expect(allowedHrefs("EMPLOYEE")).not.toContain(DEFAULT_LANDING_HREF);
  });

  it("still starts an Admin and a Manager on the dashboard", () => {
    // The other half of the rule: fixing the Employee's morning must not move
    // anybody else's. The dashboard is the first thing both of them see.
    expect(landingHref({ role: "ADMIN" })).toBe(DEFAULT_LANDING_HREF);
    expect(landingHref({ role: "MANAGER" })).toBe(DEFAULT_LANDING_HREF);
  });

  it("has nowhere to send somebody who may open nothing, and says so", () => {
    // Not a hypothetical: permissions are editable per shop (spec.md
    // "Editable role permissions"). `null` is what makes RoleGuard show the
    // refusal in words instead of redirecting into a loop or leaving an empty
    // screen behind.
    expect(landingHref(null)).toBeNull();
  });
});

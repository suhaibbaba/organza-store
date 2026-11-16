// GET /api/version — which build of the API is answering.
//
// The admin and the POS show their own build number in their account menu; a
// staff member reporting a problem reads both out, and a mismatch is usually
// the whole diagnosis (an installed app stuck on a cached build). That is only
// worth anything if the API's half is actually reachable and shaped the same.
import { describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import type { AppVersionDto } from "@tests/types";

// <major>.<minor>.<commit count> — see shared/scripts/app-version.js.
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

describe("Version", () => {
  it("reports the running build, without needing a session", async () => {
    // No token on purpose: the moment this is most needed is when a phone is
    // stuck on an old build and its user cannot get past the login screen.
    const res = await apiRequest<AppVersionDto>("/api/version");

    expect(res.status).toBe(200);
    expect(res.success).toBe(true);
    expect(res.data!.version).toMatch(VERSION_PATTERN);
  });

  it("answers a signed-in caller with the same version", async () => {
    const employee = await getSession("EMPLOYEE");
    const anonymous = await apiRequest<AppVersionDto>("/api/version");
    const authenticated = await apiRequest<AppVersionDto>("/api/version", { token: employee.token });

    expect(authenticated.status).toBe(200);
    // One deployment, one number — whoever is asking.
    expect(authenticated.data!.version).toBe(anonymous.data!.version);
  });
});

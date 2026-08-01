import { describe, expect, it } from "vitest";
import { apiRequest } from "../support/client";
import { SEEDED_ACCOUNTS, getSession, signIn, type SeededRole } from "../support/auth";
import { ERROR_CODES } from "@/constants";

describe("Auth", () => {
  it("rejects requests with no Authorization header", async () => {
    const res = await apiRequest("/api/products");
    expect(res.status).toBe(401);
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it.each(Object.keys(SEEDED_ACCOUNTS) as SeededRole[])(
    "logs in as the seeded %s account and can call a protected endpoint",
    async (role) => {
      const session = await getSession(role);
      expect(session.token).toBeTruthy();
      expect(session.role).toBe(role);

      const res = await apiRequest("/api/categories", { token: session.token });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
    }
  );

  it("rejects an incorrect password for a seeded account", async () => {
    const result = await signIn(SEEDED_ACCOUNTS.ADMIN.email, "definitely-wrong-password");
    expect(result.session).toBeUndefined();
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.status).toBeLessThan(500);
  });
});

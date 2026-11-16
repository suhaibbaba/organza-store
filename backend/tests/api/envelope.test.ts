import { describe, expect, it } from "vitest";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { ERROR_CODES } from "@/constants";

describe("Unified API envelope", () => {
  it("wraps successful responses as { success: true, data, meta }", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest("/api/products?pageSize=1", { token: admin.token });
    expect(res.status).toBe(200);
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.meta).toMatchObject({ page: 1, pageSize: 1 });
  });

  it("wraps failures as { success: false, error: { code } } using a translation key, never a literal sentence", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest("/api/products/does-not-exist", { token: admin.token });
    expect(res.status).toBe(404);
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe(ERROR_CODES.PRODUCT_NOT_FOUND);
    // Translation keys are dotted lowercase identifiers, never sentences.
    expect(res.error?.code).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
  });

  it("uses the same envelope for an unauthenticated rejection", async () => {
    const res = await apiRequest("/api/products");
    expect(res.status).toBe(401);
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });
});

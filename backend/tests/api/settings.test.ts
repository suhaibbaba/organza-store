import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Setting } from "@prisma/client";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { ERROR_CODES } from "@/constants";

describe("Settings", () => {
  let originalLowStockThreshold: number;

  beforeAll(async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<Setting>("/api/settings", { token: admin.token });
    expect(res.status).toBe(200);
    originalLowStockThreshold = res.data!.lowStockThreshold;
  });

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    await apiRequest("/api/settings", {
      method: "PATCH",
      token: admin.token,
      body: { lowStockThreshold: originalLowStockThreshold },
    });
  });

  it("is readable by any authenticated role", async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest<Setting>("/api/settings", { token: employee.token });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("currency");
  });

  it("lets Admin update settings, and restores the previous value afterward", async () => {
    const admin = await getSession("ADMIN");
    const nextValue = originalLowStockThreshold === 5 ? 6 : 5;

    const patched = await apiRequest<Setting>("/api/settings", {
      method: "PATCH",
      token: admin.token,
      body: { lowStockThreshold: nextValue },
    });
    expect(patched.status).toBe(200);
    expect(patched.data!.lowStockThreshold).toBe(nextValue);

    const restored = await apiRequest<Setting>("/api/settings", {
      method: "PATCH",
      token: admin.token,
      body: { lowStockThreshold: originalLowStockThreshold },
    });
    expect(restored.data!.lowStockThreshold).toBe(originalLowStockThreshold);
  });

  it("forbids Employee from updating settings", async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest("/api/settings", {
      method: "PATCH",
      token: employee.token,
      body: { lowStockThreshold: 99 },
    });
    expect(res.status).toBe(403);
    expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
  });
});

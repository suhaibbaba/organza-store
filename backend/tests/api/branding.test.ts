// The public branding a signed-out screen draws: the shop's own name comes from Settings, never from code.
import { describe, expect, it } from "vitest";
import type { Setting } from "@prisma/client";
import { apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import type { Branding } from "@store/shared/types/setting";

describe("Branding", () => {
  it("answers without a session and carries the store name from Settings", async () => {
    const admin = await getSession("ADMIN");
    const settings = await apiRequest<Setting>("/api/settings", { token: admin.token });
    expect(settings.status).toBe(200);

    const res = await apiRequest<Branding>("/api/branding");
    expect(res.status).toBe(200);
    expect(res.data!.storeName).toEqual(settings.data!.storeName);
    expect(res.data).toHaveProperty("logoUrl");
    expect(res.data).toHaveProperty("faviconUrls");
  });
});

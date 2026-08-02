import { describe, expect, it } from "vitest";
import { API_BASE_URL, API_ORIGIN, apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import type { ErrorBody, ProductDto } from "@tests/types";
import { ERROR_CODES } from "@/constants";

// Per the task scope, multipart upload is NOT exercised deeply here — just
// that the endpoint exists and rejects bad input (missing auth, missing file).
describe("Images", () => {
  it("rejects an unauthenticated upload attempt", async () => {
    const res = await fetch(`${API_BASE_URL}/api/images`, { method: "POST", headers: { Origin: API_ORIGIN } });
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    expect(res.status).toBe(401);
    expect(body.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it("rejects an upload request that is missing the file", async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    const product = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: "اختبار صورة", en: "Vitest Image Product" }, categoryId, basePrice: "10" },
    });
    expect(product.status).toBe(201);
    const productId = product.data!.id;

    try {
      const form = new FormData();
      form.append("productId", productId);
      const res = await fetch(`${API_BASE_URL}/api/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${admin.token}`, Origin: API_ORIGIN },
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as ErrorBody;

      expect(res.status).toBe(400);
      expect(body.error?.code).toBe(ERROR_CODES.IMAGE_FILE_REQUIRED);
    } finally {
      await apiRequest(`/api/products/${productId}`, { method: "DELETE", token: admin.token });
    }
  });
});

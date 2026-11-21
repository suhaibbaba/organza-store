import { describe, expect, it } from "vitest";
import { API_BASE_URL, API_ORIGIN, apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import { DARK_PNG, LIGHT_PNG, TINY_PNG } from "@tests/constants";
import type { ErrorBody, ImageDto, ProductDto } from "@tests/types";
import { ERROR_CODES } from "@/constants";
import { IMAGE_BRIGHTNESS_LIGHT_THRESHOLD } from "@store/shared/constants/numberedShawl";

// Upload is only smoke-tested; the round trip proves a written photo is served. The volume half is checked by the deploy's /health.
describe("Images", () => {
  it("serves an uploaded image back from the directory it was written to", async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    const product = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: "اختبار حفظ الصورة", en: "Vitest Image Roundtrip" }, categoryId, basePrice: "10" },
    });
    const productId = product.data!.id;

    try {
      const form = new FormData();
      form.append("productId", productId);
      form.append("file", new Blob([TINY_PNG], { type: "image/png" }), "photo.png");

      const upload = await fetch(`${API_BASE_URL}/api/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${admin.token}`, Origin: API_ORIGIN },
        body: form,
      });
      const uploaded = (await upload.json()) as { data: ImageDto };
      expect(upload.status).toBe(201);

      // Fetched the way both apps do, unauthenticated from /uploads: a 404 is a broken thumbnail.
      for (const url of [uploaded.data.url, uploaded.data.mediumUrl, uploaded.data.thumbnailUrl]) {
        expect(url.startsWith("/uploads/")).toBe(true);
        const fetched = await fetch(`${API_BASE_URL}${url}`);
        expect(fetched.status).toBe(200);
        expect(fetched.headers.get("content-type")).toContain("image/webp");
        // Served off disk, so an empty body means the file exists in name only.
        expect((await fetched.arrayBuffer()).byteLength).toBeGreaterThan(0);

        // CORP same-origin makes the browser drop the image on another origin, which every page here is.
        expect(fetched.headers.get("cross-origin-resource-policy")).not.toBe("same-origin");
      }
      // The original is kept for a later re-crop, and the editor loads it straight in the browser.
      const originalUrl = uploaded.data.originalUrl;
      expect(originalUrl).toBeTruthy();
      const original = await fetch(`${API_BASE_URL}${originalUrl}`);
      expect(original.status).toBe(200);
      expect(original.headers.get("cross-origin-resource-policy")).not.toBe("same-origin");
      expect((await original.arrayBuffer()).byteLength).toBeGreaterThan(0);
    } finally {
      await apiRequest(`/api/products/${productId}`, { method: "DELETE", token: admin.token });
    }
  });

  // One reading at upload decides every later marker-colour suggestion, so it must tell dark from light.
  it("measures how light or dark an uploaded photograph is", async () => {
    const admin = await getSession("ADMIN");
    const categoryId = await anyCategoryId(admin.token);
    const product = await apiRequest<ProductDto>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: "اختبار إضاءة الصورة", en: "Vitest Image Brightness" }, categoryId, basePrice: "10" },
    });
    const productId = product.data!.id;

    async function upload(bytes: Buffer): Promise<number | null> {
      const form = new FormData();
      form.append("productId", productId);
      form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "photo.png");
      const res = await fetch(`${API_BASE_URL}/api/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${admin.token}`, Origin: API_ORIGIN },
        body: form,
      });
      expect(res.status).toBe(201);
      return ((await res.json()) as { data: ImageDto }).data.brightness;
    }

    try {
      const dark = await upload(DARK_PNG);
      const light = await upload(LIGHT_PNG);

      // What matters is that a black and a white photo do not get the same answer.
      expect(dark).not.toBeNull();
      expect(light).not.toBeNull();
      expect(dark!).toBeLessThan(IMAGE_BRIGHTNESS_LIGHT_THRESHOLD);
      expect(light!).toBeGreaterThanOrEqual(IMAGE_BRIGHTNESS_LIGHT_THRESHOLD);

      // And it survives to the product screens, which is where it is read.
      const reloaded = await apiRequest<ProductDto>(`/api/products/${productId}`, { token: admin.token });
      expect(reloaded.data!.images.every((image) => image.brightness !== null)).toBe(true);
    } finally {
      await apiRequest(`/api/products/${productId}`, { method: "DELETE", token: admin.token });
    }
  });

  it("reports whether it can write uploads at all", async () => {
    // The deploy checks this after every release: false means the uploads volume is not mounted or not writable.
    const res = await fetch(`${API_BASE_URL}/health`);
    const body = (await res.json()) as { data: { status: string; uploadsWritable: boolean } };
    expect(res.status).toBe(200);
    expect(body.data.uploadsWritable).toBe(true);
  });

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

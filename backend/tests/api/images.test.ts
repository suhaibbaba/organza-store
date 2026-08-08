import { describe, expect, it } from "vitest";
import { API_BASE_URL, API_ORIGIN, apiRequest } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import { TINY_PNG } from "@tests/constants";
import type { ErrorBody, ImageDto, ProductDto } from "@tests/types";
import { ERROR_CODES } from "@/constants";

// Per the task scope, multipart upload is NOT exercised deeply here — just
// that the endpoint exists, rejects bad input (missing auth, missing file),
// and that an image which uploads successfully can then actually be FETCHED
// back.
//
// The round trip covers the half of "photos disappear on deploy" that lives
// in the app: written, and served from where it was written. It cannot cover
// the other half — that the directory is the mounted volume rather than the
// container's own layer — because both halves look identical to a single
// running process, which is exactly why that bug survived so long. That one
// is checked where it is decidable: against the compose file's resolved
// config, and by the deploy asking /health after every release.
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

      // Every size sharp wrote, fetched the way the admin and the POS fetch
      // them: an ordinary unauthenticated GET against the API's /uploads.
      // A 404 here is what the shop sees as a broken thumbnail.
      for (const url of [uploaded.data.url, uploaded.data.mediumUrl, uploaded.data.thumbnailUrl]) {
        expect(url.startsWith("/uploads/")).toBe(true);
        const fetched = await fetch(`${API_BASE_URL}${url}`);
        expect(fetched.status).toBe(200);
        expect(fetched.headers.get("content-type")).toContain("image/webp");
        // Served off disk, so a zero-length body would mean the file is there
        // in name only.
        expect((await fetched.arrayBuffer()).byteLength).toBeGreaterThan(0);
      }
    } finally {
      await apiRequest(`/api/products/${productId}`, { method: "DELETE", token: admin.token });
    }
  });

  it("reports whether it can write uploads at all", async () => {
    // What the deploy checks after every release (see
    // .github/workflows/deploy-sandbox.yml). `false` means the volume is not
    // mounted where the app is pointed, or the container's user cannot write
    // to it — the API keeps serving everything else, and every image upload
    // fails.
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

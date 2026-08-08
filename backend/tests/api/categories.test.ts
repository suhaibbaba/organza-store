import { afterAll, describe, expect, it } from "vitest";
import type { Category } from "@prisma/client";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { ERROR_CODES } from "@/constants";
import type { CategoryNode } from "@/types";

function findNode(nodes: CategoryNode[], id: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

describe("Categories", () => {
  const nonce = uniqueId();
  let parentId: string | undefined;
  let childId: string | undefined;
  let childProductId: string | undefined;

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    // Products first: a category with anything filed under it refuses to be
    // deleted (CATEGORY_HAS_PRODUCTS), so the shelf can only be cleared once
    // what is on it has gone.
    if (childProductId) await apiRequest(`/api/products/${childProductId}`, { method: "DELETE", token: admin.token });
    if (childId) await apiRequest(`/api/categories/${childId}`, { method: "DELETE", token: admin.token });
    if (parentId) await apiRequest(`/api/categories/${parentId}`, { method: "DELETE", token: admin.token });
  });

  it("creates a parent category (Admin/Manager)", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<Category>("/api/categories", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: `تصنيف ${nonce}`, en: `Vitest Parent ${nonce}` } },
    });
    expect(res.status).toBe(201);
    parentId = res.data!.id;
  });

  it("nests a child category under the parent", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<Category>("/api/categories", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: `تصنيف فرعي ${nonce}`, en: `Vitest Child ${nonce}` }, parentId },
    });
    expect(res.status).toBe(201);
    childId = res.data!.id;
    expect(res.data!.parentId).toBe(parentId);

    const tree = await apiRequest<CategoryNode[]>("/api/categories", { token: admin.token });
    const parentNode = findNode(tree.data!, parentId!);
    expect(parentNode?.children.some((c) => c.id === childId)).toBe(true);
  });

  it("forbids Employee from creating a category", async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest("/api/categories", {
      method: "POST",
      token: employee.token,
      body: { name: { ar: `ممنوع ${nonce}` } },
    });
    expect(res.status).toBe(403);
    expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  // The POS product browser's sidebar pins these to the top, on every till
  // (spec.md "POS product browser") — so the flag is stored on the category
  // and gated like every other category edit.
  it("pins and unpins a category as a favourite", async () => {
    const admin = await getSession("ADMIN");

    const pinned = await apiRequest<Category>(`/api/categories/${childId}`, {
      method: "PATCH",
      token: admin.token,
      body: { isFavorite: true },
    });
    expect(pinned.status).toBe(200);
    expect(pinned.data!.isFavorite).toBe(true);

    const listed = await apiRequest<Category[]>("/api/categories?flat=true", { token: admin.token });
    expect(listed.data!.find((c) => c.id === childId)?.isFavorite).toBe(true);

    const unpinned = await apiRequest<Category>(`/api/categories/${childId}`, {
      method: "PATCH",
      token: admin.token,
      body: { isFavorite: false },
    });
    expect(unpinned.data!.isFavorite).toBe(false);
  });

  it("forbids Employee from pinning a category", async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest(`/api/categories/${childId}`, {
      method: "PATCH",
      token: employee.token,
      body: { isFavorite: true },
    });
    expect(res.status).toBe(403);
    expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  // Products hang off leaves, so the browser asking for a parent shelf has to
  // be answered with everything under it — otherwise tapping "Women" shows an
  // empty grid while the dresses sit one level down.
  it("lists a child category's products under the parent only with includeSubcategories", async () => {
    const admin = await getSession("ADMIN");
    const name = `Vitest Subtree ${nonce}`;

    const created = await apiRequest<{ id: string }>("/api/products", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: name, en: name }, categoryId: childId, basePrice: "42" },
    });
    expect(created.status).toBe(201);
    childProductId = created.data!.id;

    const parentOnly = await apiRequest<{ id: string }[]>(`/api/products?categoryId=${parentId}`, {
      token: admin.token,
    });
    expect(parentOnly.data!.some((p) => p.id === childProductId)).toBe(false);

    const wholeBranch = await apiRequest<{ id: string }[]>(
      `/api/products?categoryId=${parentId}&includeSubcategories=true`,
      { token: admin.token }
    );
    expect(wholeBranch.data!.some((p) => p.id === childProductId)).toBe(true);
  });

  it("rejects reparenting a category under its own child (circular parent)", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest(`/api/categories/${parentId}`, {
      method: "PATCH",
      token: admin.token,
      body: { parentId: childId },
    });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe(ERROR_CODES.CATEGORY_CIRCULAR_PARENT);
  });

  it("refuses to delete a category that still has children", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest(`/api/categories/${parentId}`, { method: "DELETE", token: admin.token });
    expect(res.status).toBe(409);
    expect(res.error?.code).toBe(ERROR_CODES.CATEGORY_HAS_CHILDREN);
  });
});

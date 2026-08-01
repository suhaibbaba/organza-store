import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "../support/client";
import { getSession } from "../support/auth";
import { ERROR_CODES } from "@/constants";

interface CategoryNode {
  id: string;
  parentId: string | null;
  children: CategoryNode[];
}

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

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    if (childId) await apiRequest(`/api/categories/${childId}`, { method: "DELETE", token: admin.token });
    if (parentId) await apiRequest(`/api/categories/${parentId}`, { method: "DELETE", token: admin.token });
  });

  it("creates a parent category (Admin/Manager)", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<{ id: string }>("/api/categories", {
      method: "POST",
      token: admin.token,
      body: { name: { ar: `تصنيف ${nonce}`, en: `Vitest Parent ${nonce}` } },
    });
    expect(res.status).toBe(201);
    parentId = res.data!.id;
  });

  it("nests a child category under the parent", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<{ id: string; parentId: string | null }>("/api/categories", {
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

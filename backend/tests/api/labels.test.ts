// Barcode-label printing (CLAUDE.md rule 13): the store generates every
// barcode itself, so a product is only shelf-ready once its label has been
// printed and stuck on. This suite covers the record of that — the print
// timestamp and the work queue built on it — plus the label geometry that
// lets any printer the shop happens to own produce the sheet.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Setting } from "@prisma/client";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import type { MarkLabelsPrintedDto, ProductDto, ProductSummaryDto } from "@tests/types";
import { ERROR_CODES } from "@/constants";

async function createProduct(token: string, name: string): Promise<ProductDto> {
  const categoryId = await anyCategoryId(token);
  const res = await apiRequest<ProductDto>("/api/products", {
    method: "POST",
    token,
    body: { name: { ar: name, en: name }, categoryId, basePrice: "40" },
  });
  if (res.status !== 201 || !res.data) {
    throw new Error(`Could not create a product for the labels suite (HTTP ${res.status}).`);
  }
  return res.data;
}

async function readProduct(token: string, id: string): Promise<ProductDto> {
  const res = await apiRequest<ProductDto>(`/api/products/${id}`, { token });
  if (res.status !== 200 || !res.data) {
    throw new Error(`Could not read product ${id} (HTTP ${res.status}).`);
  }
  return res.data;
}

describe("Barcode labels", () => {
  const createdProductIds: string[] = [];

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of createdProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  describe("print tracking", () => {
    it("stamps a batch as printed, and still allows a reprint afterwards", async () => {
      const admin = await getSession("ADMIN");
      const product = await createProduct(admin.token, `Vitest Label ${uniqueId()}`);
      createdProductIds.push(product.id);

      // A brand-new product has never been through the printer.
      expect(product.labelsPrintedAt).toBeNull();

      const first = await apiRequest<MarkLabelsPrintedDto>("/api/products/labels/printed", {
        method: "POST",
        token: admin.token,
        body: { productIds: [product.id] },
      });
      expect(first.status).toBe(200);
      expect(first.data!.productIds).toEqual([product.id]);
      expect(first.data!.labelsPrintedAt).toBeTruthy();

      const afterFirst = await readProduct(admin.token, product.id);
      expect(afterFirst.labelsPrintedAt).toBe(first.data!.labelsPrintedAt);

      // Labels fall off and rolls jam — printing again is never blocked, it
      // just moves the timestamp forward.
      const second = await apiRequest<MarkLabelsPrintedDto>("/api/products/labels/printed", {
        method: "POST",
        token: admin.token,
        body: { productIds: [product.id] },
      });
      expect(second.status).toBe(200);

      const afterSecond = await readProduct(admin.token, product.id);
      expect(afterSecond.labelsPrintedAt).toBe(second.data!.labelsPrintedAt);
      expect(new Date(afterSecond.labelsPrintedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(afterFirst.labelsPrintedAt!).getTime()
      );
    });

    it("lets an Employee print the labels of a product they just added", async () => {
      const employee = await getSession("EMPLOYEE");
      const product = await createProduct(employee.token, `Vitest Label Employee ${uniqueId()}`);
      createdProductIds.push(product.id);

      const res = await apiRequest<MarkLabelsPrintedDto>("/api/products/labels/printed", {
        method: "POST",
        token: employee.token,
        body: { productIds: [product.id] },
      });

      expect(res.status).toBe(200);
      expect((await readProduct(employee.token, product.id)).labelsPrintedAt).toBe(res.data!.labelsPrintedAt);
    });

    it("filters the product list by print state", async () => {
      const admin = await getSession("ADMIN");
      // A shared nonce in both names narrows the list down to (roughly) these
      // two — the search is deliberately fuzzy (CLAUDE.md rule 10), so the
      // assertions below are about which of the two shows up, not about the
      // exact contents of the page.
      const nonce = uniqueId();
      const printed = await createProduct(admin.token, `Vitest Printstate ${nonce} A`);
      const notPrinted = await createProduct(admin.token, `Vitest Printstate ${nonce} B`);
      createdProductIds.push(printed.id, notPrinted.id);

      await apiRequest("/api/products/labels/printed", {
        method: "POST",
        token: admin.token,
        body: { productIds: [printed.id] },
      });

      const ids = async (printState: string): Promise<string[]> => {
        const res = await apiRequest<ProductSummaryDto[]>(
          `/api/products?q=${encodeURIComponent(nonce)}&printState=${printState}`,
          { token: admin.token }
        );
        expect(res.status).toBe(200);
        return res.data!.map((p) => p.id);
      };

      const stillToPrint = await ids("not_printed");
      expect(stillToPrint).toContain(notPrinted.id);
      expect(stillToPrint).not.toContain(printed.id);

      const alreadyPrinted = await ids("printed");
      expect(alreadyPrinted).toContain(printed.id);
      expect(alreadyPrinted).not.toContain(notPrinted.id);

      // The default is no filtering at all.
      const everything = await ids("all");
      expect(everything).toEqual(expect.arrayContaining([printed.id, notPrinted.id]));
    });

    it("refuses a batch containing an unknown product, and prints none of it", async () => {
      const admin = await getSession("ADMIN");
      const product = await createProduct(admin.token, `Vitest Label Partial ${uniqueId()}`);
      createdProductIds.push(product.id);

      const res = await apiRequest("/api/products/labels/printed", {
        method: "POST",
        token: admin.token,
        body: { productIds: [product.id, `missing-${uniqueId()}`] },
      });

      expect(res.status).toBe(404);
      expect(res.error?.code).toBe(ERROR_CODES.PRODUCT_NOT_FOUND);
      // All or nothing — a half-applied run would leave the queue lying about
      // which labels are still owed.
      expect((await readProduct(admin.token, product.id)).labelsPrintedAt).toBeNull();
    });

    it("rejects an empty batch", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest("/api/products/labels/printed", {
        method: "POST",
        token: admin.token,
        body: { productIds: [] },
      });

      expect(res.status).toBe(400);
      expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
    });
  });

  describe("label settings", () => {
    let original: Setting;

    beforeAll(async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest<Setting>("/api/settings", { token: admin.token });
      expect(res.status).toBe(200);
      original = res.data!;
    });

    afterAll(async () => {
      const admin = await getSession("ADMIN");
      await apiRequest("/api/settings", {
        method: "PATCH",
        token: admin.token,
        body: {
          labelPrintMode: original.labelPrintMode,
          labelWidthMm: original.labelWidthMm,
          labelHeightMm: original.labelHeightMm,
          labelColumns: original.labelColumns,
          labelRows: original.labelRows,
          labelPageMarginTopMm: original.labelPageMarginTopMm,
          labelPageMarginRightMm: original.labelPageMarginRightMm,
          labelPageMarginBottomMm: original.labelPageMarginBottomMm,
          labelPageMarginLeftMm: original.labelPageMarginLeftMm,
          labelGapXMm: original.labelGapXMm,
          labelGapYMm: original.labelGapYMm,
        },
      });
    });

    it("is readable by staff, so the POS/admin can lay a sheet out", async () => {
      const employee = await getSession("EMPLOYEE");
      const res = await apiRequest<Setting>("/api/settings", { token: employee.token });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("labelPrintMode");
      expect(typeof res.data!.labelWidthMm).toBe("number");
      expect(typeof res.data!.labelColumns).toBe("number");
    });

    it("lets Admin switch to an A4 grid and describe the sheet", async () => {
      const admin = await getSession("ADMIN");
      const res = await apiRequest<Setting>("/api/settings", {
        method: "PATCH",
        token: admin.token,
        body: {
          labelPrintMode: "A4_GRID",
          labelWidthMm: 63.5,
          labelHeightMm: 38.1,
          labelColumns: 3,
          labelRows: 7,
          labelPageMarginTopMm: 15.1,
          labelPageMarginLeftMm: 7.2,
          labelGapXMm: 2.5,
          labelGapYMm: 0,
        },
      });

      expect(res.status).toBe(200);
      expect(res.data!.labelPrintMode).toBe("A4_GRID");
      expect(res.data!.labelWidthMm).toBe(63.5);
      expect(res.data!.labelHeightMm).toBe(38.1);
      expect(res.data!.labelRows).toBe(7);
      expect(res.data!.labelPageMarginTopMm).toBe(15.1);
      // A sticker sheet with no gap between rows is a real thing.
      expect(res.data!.labelGapYMm).toBe(0);
    });

    it("rejects a label that isn't a piece of paper", async () => {
      const admin = await getSession("ADMIN");

      const zeroWidth = await apiRequest("/api/settings", {
        method: "PATCH",
        token: admin.token,
        body: { labelWidthMm: 0 },
      });
      expect(zeroWidth.status).toBe(400);
      expect(zeroWidth.error?.code).toBe(ERROR_CODES.VALIDATION);

      const noColumns = await apiRequest("/api/settings", {
        method: "PATCH",
        token: admin.token,
        body: { labelColumns: 0 },
      });
      expect(noColumns.status).toBe(400);
      expect(noColumns.error?.code).toBe(ERROR_CODES.VALIDATION);
    });

    it("forbids Manager and Employee from changing the label sheet", async () => {
      for (const role of ["MANAGER", "EMPLOYEE"] as const) {
        const session = await getSession(role);
        const res = await apiRequest("/api/settings", {
          method: "PATCH",
          token: session.token,
          body: { labelWidthMm: 99 },
        });
        expect(res.status).toBe(403);
        expect(res.error?.code).toBe(ERROR_CODES.FORBIDDEN);
      }
    });
  });
});

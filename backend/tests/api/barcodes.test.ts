// Supplier barcodes (shared/constants/barcode.ts).
//
// Auto-generation is still the default (CLAUDE.md rule 13) — that is covered in
// products.test.ts and edgeCases.verify.test.ts. This suite covers the other
// case: a garment that arrived already barcoded, whose printed code the shop
// keeps instead of covering with a label of its own.
//
// Everything asserted here is a way the shop could otherwise lose money or
// time: a duplicate code sells the wrong piece, a parent code sold as an item
// deducts stock from the wrong size, a toggle that mints a new code strands the
// label already stuck on the garment, and a piece that came barcoded sitting in
// the "still to print" queue wastes a label and a minute per piece.
import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId, twoByTwoOptionSelections } from "@tests/support/fixtures";
import type { OrderDto, ProductDto, ProductLookupDto, ProductSummaryDto } from "@tests/types";
import { ERROR_CODES, PRODUCT_LOOKUP_KIND } from "@/constants";

// A code that cannot collide with one this system generates (those all start
// 200-299, src/constants/barcode.ts) nor with another run of this suite.
function supplierCode(): string {
  const digits = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12);
  return `9${digits}`;
}

async function createProduct(token: string, body: Record<string, unknown>): Promise<ProductDto> {
  const categoryId = await anyCategoryId(token);
  const name = `Vitest Barcode ${uniqueId()}`;
  const res = await apiRequest<ProductDto>("/api/products", {
    method: "POST",
    token,
    body: { name: { ar: name, en: name }, categoryId, basePrice: "50", ...body },
  });
  if (res.status !== 201 || !res.data) {
    throw new Error(`Could not create a product for the barcodes suite (HTTP ${res.status}).`);
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

async function lookup(token: string, code: string) {
  return apiRequest<ProductLookupDto>(`/api/products/lookup?code=${encodeURIComponent(code)}`, { token });
}

// Whether the product appears in the "labels still to print" queue. The list
// filter is the queue, so this asks the API the same question the screen does.
async function inNotPrintedQueue(token: string, productId: string): Promise<boolean> {
  const res = await apiRequest<ProductSummaryDto[]>(
    `/api/products?printState=not_printed&pageSize=100&q=${encodeURIComponent("Vitest Barcode")}`,
    { token }
  );
  return (res.data ?? []).some((product) => product.id === productId);
}

describe("Supplier barcodes", () => {
  const createdProductIds: string[] = [];
  const openedOrderIds: string[] = [];

  async function product(token: string, body: Record<string, unknown> = {}): Promise<ProductDto> {
    const created = await createProduct(token, body);
    createdProductIds.push(created.id);
    return created;
  }

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of openedOrderIds) {
      await apiRequest(`/api/orders/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of createdProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  describe("entering the code the garment came with", () => {
    it("keeps a supplier code on create, and records that it is the supplier's", async () => {
      const admin = await getSession("ADMIN");
      const code = supplierCode();
      const created = await product(admin.token, { barcodeSource: "SUPPLIER", barcode: code });

      expect(created.barcode).toBe(code);
      expect(created.barcodeSource).toBe("SUPPLIER");
      // Stored, not inferred: the same product read back says the same thing.
      const reloaded = await readProduct(admin.token, created.id);
      expect(reloaded.barcodeSource).toBe("SUPPLIER");

      // And a scan of it resolves to this product, which is the whole point.
      const scan = await lookup(admin.token, code);
      expect(scan.status).toBe(200);
      expect(scan.data!.product.id).toBe(created.id);
    });

    it("normalizes what was typed: stray whitespace and Arabic-Indic digits", async () => {
      const admin = await getSession("ADMIN");
      const code = supplierCode();
      // ٤٠١ is 401 — the shop types on an Arabic keyboard, whose digit row
      // sends Arabic-Indic digits, and every code in the catalogue is ASCII. A
      // code stored as typed would never scan.
      const asTyped = ` ${code.slice(0, 4).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)])} ${code.slice(4)} `;
      const created = await product(admin.token, { barcodeSource: "SUPPLIER", barcode: asTyped });

      expect(created.barcode).toBe(code);
      // The scan a cashier will actually make finds it.
      const scan = await lookup(admin.token, code);
      expect(scan.data!.product.id).toBe(created.id);
    });

    it("refuses the supplier option with no code, and a code no scanner could produce", async () => {
      const admin = await getSession("ADMIN");
      const categoryId = await anyCategoryId(admin.token);
      const name = `Vitest Barcode ${uniqueId()}`;

      for (const barcode of [undefined, "ش ش", "12"]) {
        const res = await apiRequest<ProductDto>("/api/products", {
          method: "POST",
          token: admin.token,
          body: {
            name: { ar: name, en: name },
            categoryId,
            basePrice: "50",
            barcodeSource: "SUPPLIER",
            ...(barcode === undefined ? {} : { barcode }),
          },
        });
        // Nothing is generated in its place: the garment either carries a tag
        // or it doesn't, and guessing would put a code on the shelf that
        // matches nothing.
        expect(res.status, `barcode ${JSON.stringify(barcode)}`).toBe(400);
        expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
      }
    });
  });

  describe("replacing and toggling, in both directions", () => {
    it("replaces one supplier code with another", async () => {
      const admin = await getSession("ADMIN");
      const first = supplierCode();
      const created = await product(admin.token, { barcodeSource: "SUPPLIER", barcode: first });

      const second = supplierCode();
      const patched = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "SUPPLIER", barcode: second },
      });

      expect(patched.status).toBe(200);
      expect(patched.data!.barcode).toBe(second);
      expect(patched.data!.barcodeSource).toBe("SUPPLIER");
      // The code it no longer carries must stop resolving to it.
      const oldScan = await lookup(admin.token, first);
      expect(oldScan.status).toBe(404);
    });

    it("switches back to our own code — restoring the one already on the printed label", async () => {
      const admin = await getSession("ADMIN");
      // Starts on ours, so there IS a label in circulation to protect.
      const created = await product(admin.token);
      const ours = created.barcode!;
      expect(created.barcodeSource).toBe("GENERATED");

      const toSupplier = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "SUPPLIER", barcode: supplierCode() },
      });
      expect(toSupplier.status).toBe(200);
      expect(toSupplier.data!.barcode).not.toBe(ours);

      const back = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "GENERATED" },
      });
      expect(back.status).toBe(200);
      expect(back.data!.barcodeSource).toBe("GENERATED");
      expect(
        back.data!.barcode,
        "the code we minted comes back, so a label already stuck on the piece still scans"
      ).toBe(ours);

      // Reversible any number of times, and it is the toggle that decides —
      // never a leftover code lying around.
      const again = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "SUPPLIER", barcode: supplierCode() },
      });
      expect(again.data!.barcodeSource).toBe("SUPPLIER");
      const andBack = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "GENERATED" },
      });
      expect(andBack.data!.barcode).toBe(ours);
    });

    it("mints a fresh code for a product that never had one of ours", async () => {
      const admin = await getSession("ADMIN");
      const created = await product(admin.token, { barcodeSource: "SUPPLIER", barcode: supplierCode() });

      const back = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "GENERATED" },
      });
      expect(back.status).toBe(200);
      expect(back.data!.barcodeSource).toBe("GENERATED");
      expect(back.data!.barcode).toBeTruthy();
      expect(back.data!.barcode).not.toBe(created.barcode);
    });

    it("leaves the barcode alone on a save that says nothing about it", async () => {
      const admin = await getSession("ADMIN");
      const code = supplierCode();
      const created = await product(admin.token, { barcodeSource: "SUPPLIER", barcode: code });

      const renamed = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { basePrice: "77" },
      });
      expect(renamed.status).toBe(200);
      expect(renamed.data!.barcode).toBe(code);
      expect(renamed.data!.barcodeSource).toBe("SUPPLIER");
    });

    it("gives each variant its own code, independent of the parent's", async () => {
      const admin = await getSession("ADMIN");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const created = await product(admin.token, { optionSelections });
      const [first, second] = created.variants;
      const ours = first.barcode!;

      const code = supplierCode();
      const patched = await apiRequest<ProductDto["variants"][number]>(
        `/api/products/${created.id}/variants/${first.id}`,
        { method: "PATCH", token: admin.token, body: { barcodeSource: "SUPPLIER", barcode: code } }
      );
      expect(patched.status).toBe(200);
      expect(patched.data!.barcode).toBe(code);
      expect(patched.data!.barcodeSource).toBe("SUPPLIER");

      const reloaded = await readProduct(admin.token, created.id);
      // Its sibling is untouched, and so is the parent.
      expect(reloaded.variants.find((v) => v.id === second.id)!.barcodeSource).toBe("GENERATED");
      expect(reloaded.barcodeSource).toBe("GENERATED");

      // Scanning that size adds it directly — it IS one piece.
      const scan = await lookup(admin.token, code);
      expect(scan.data!.kind).toBe(PRODUCT_LOOKUP_KIND.ITEM);
      expect(scan.data!.variant?.id).toBe(first.id);

      // And the variant toggles back to its own printed code, like the parent.
      const back = await apiRequest<ProductDto["variants"][number]>(
        `/api/products/${created.id}/variants/${first.id}`,
        { method: "PATCH", token: admin.token, body: { barcodeSource: "GENERATED" } }
      );
      expect(back.data!.barcode).toBe(ours);
    });
  });

  describe("uniqueness across the whole store", () => {
    it("refuses a code another product already uses, and names the conflict", async () => {
      const admin = await getSession("ADMIN");
      const code = supplierCode();
      const holder = await product(admin.token, { barcodeSource: "SUPPLIER", barcode: code });
      const other = await product(admin.token);

      const clash = await apiRequest(`/api/products/${other.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "SUPPLIER", barcode: code },
      });

      expect(clash.status).toBe(409);
      expect(clash.error?.code).toBe(ERROR_CODES.BARCODE_DUPLICATE);
      // "Already used" is unanswerable without saying by what.
      const details = clash.error?.details as { kind?: string; sku?: string; productId?: string } | undefined;
      expect(details?.kind).toBe("product");
      expect(details?.productId).toBe(holder.id);
      expect(details?.sku).toBe(holder.sku);

      // And nothing was written: the other product keeps the code it had.
      const untouched = await readProduct(admin.token, other.id);
      expect(untouched.barcode).toBe(other.barcode);
      expect(untouched.barcodeSource).toBe("GENERATED");
    });

    it("refuses one of OUR generated codes too — products and variants share one namespace", async () => {
      const admin = await getSession("ADMIN");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const withVariants = await product(admin.token, { optionSelections });
      const variantCode = withVariants.variants[0].barcode!;
      const target = await product(admin.token);

      const clash = await apiRequest(`/api/products/${target.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "SUPPLIER", barcode: variantCode },
      });

      expect(clash.status).toBe(409);
      expect(clash.error?.code).toBe(ERROR_CODES.BARCODE_DUPLICATE);
      const details = clash.error?.details as { kind?: string; variantId?: string } | undefined;
      expect(details?.kind, "the clash is with a variant, and says so").toBe("variant");
      expect(details?.variantId).toBe(withVariants.variants[0].id);
    });

    it("accepts the code a product already holds — re-saving a form is not a clash with itself", async () => {
      const admin = await getSession("ADMIN");
      const code = supplierCode();
      const created = await product(admin.token, { barcodeSource: "SUPPLIER", barcode: code });

      const resaved = await apiRequest<ProductDto>(`/api/products/${created.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "SUPPLIER", barcode: code },
      });
      expect(resaved.status).toBe(200);
      expect(resaved.data!.barcode).toBe(code);
    });
  });

  describe("one supplier code for every size, on the parent", () => {
    it("answers a scan of it with the choice, and refuses a sale that names no variant", async () => {
      const admin = await getSession("ADMIN");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const code = supplierCode();
      const created = await product(admin.token, {
        optionSelections,
        barcodeSource: "SUPPLIER",
        barcode: code,
      });

      const scan = await lookup(admin.token, code);
      expect(scan.status).toBe(200);
      // The same mechanism as a numbered shawl's collection label: the code
      // names the garment, not the size that just sold.
      expect(scan.data!.kind).toBe(PRODUCT_LOOKUP_KIND.VARIANT_SELECTION);
      expect(scan.data!.variant, "nothing sellable comes back").toBeNull();
      expect(scan.data!.product.variants.length, "the picker has every size to choose from").toBe(
        created.variants.length
      );
      // `numbers` is the numbered flavour of the same answer, and this product
      // is not numbered.
      expect(scan.data!.numbers).toEqual([]);

      const sold = await apiRequest<OrderDto>("/api/orders", {
        method: "POST",
        token: admin.token,
        body: { channel: "STORE", items: [{ productId: created.id, quantity: 1 }] },
      });
      if (sold.data?.id) openedOrderIds.push(sold.data.id);
      expect(sold.status, "a sale on the parent alone deducts stock from the wrong place").toBe(400);
      expect(sold.error?.code).toBe(ERROR_CODES.ORDER_VARIANT_REQUIRED);

      // Naming a size is what makes it a sale.
      const withVariant = await apiRequest<OrderDto>("/api/orders", {
        method: "POST",
        token: admin.token,
        body: {
          channel: "STORE",
          items: [{ productId: created.id, variantId: created.variants[0].id, quantity: 1 }],
        },
      });
      if (withVariant.data?.id) openedOrderIds.push(withVariant.data.id);
      expect(withVariant.status).toBe(201);
    });

    it("lets both levels coexist: the parent's code asks, a variant's code sells", async () => {
      const admin = await getSession("ADMIN");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const parentCode = supplierCode();
      const created = await product(admin.token, {
        optionSelections,
        barcodeSource: "SUPPLIER",
        barcode: parentCode,
      });

      const variantCode = supplierCode();
      const patched = await apiRequest(`/api/products/${created.id}/variants/${created.variants[0].id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "SUPPLIER", barcode: variantCode },
      });
      expect(patched.status).toBe(200);

      const parentScan = await lookup(admin.token, parentCode);
      expect(parentScan.data!.kind).toBe(PRODUCT_LOOKUP_KIND.VARIANT_SELECTION);

      const variantScan = await lookup(admin.token, variantCode);
      expect(variantScan.data!.kind).toBe(PRODUCT_LOOKUP_KIND.ITEM);
      expect(variantScan.data!.variant?.id).toBe(created.variants[0].id);
    });
  });

  describe("the labels queue", () => {
    it("drops a supplier-coded piece from 'not printed yet' without faking a print", async () => {
      const admin = await getSession("ADMIN");
      const ours = await product(admin.token);
      const theirs = await product(admin.token, { barcodeSource: "SUPPLIER", barcode: supplierCode() });

      expect(await inNotPrintedQueue(admin.token, ours.id), "our own code still owes a label").toBe(true);
      expect(await inNotPrintedQueue(admin.token, theirs.id), "a garment that came barcoded does not").toBe(false);

      // Excluded by SOURCE, never by pretending the label was printed — the
      // print date is a record of something that happened.
      const reloaded = await readProduct(admin.token, theirs.id);
      expect(reloaded.labelsPrintedAt).toBeNull();

      // ...and printing one anyway stays possible.
      const printed = await apiRequest("/api/products/labels/printed", {
        method: "POST",
        token: admin.token,
        body: { productIds: [theirs.id] },
      });
      expect(printed.status).toBe(200);
    });

    it("follows the toggle: back to our code, back into the queue", async () => {
      const admin = await getSession("ADMIN");
      const created = await product(admin.token, { barcodeSource: "SUPPLIER", barcode: supplierCode() });
      expect(await inNotPrintedQueue(admin.token, created.id)).toBe(false);

      const back = await apiRequest(`/api/products/${created.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { barcodeSource: "GENERATED" },
      });
      expect(back.status).toBe(200);
      expect(await inNotPrintedQueue(admin.token, created.id), "our code means our label").toBe(true);
    });

    it("keeps a variant product in the queue until every size carries a supplier code", async () => {
      const admin = await getSession("ADMIN");
      const optionSelections = await twoByTwoOptionSelections(admin.token);
      const created = await product(admin.token, { optionSelections });

      const variants = created.variants;
      for (const [index, variant] of variants.entries()) {
        const res = await apiRequest(`/api/products/${created.id}/variants/${variant.id}`, {
          method: "PATCH",
          token: admin.token,
          body: { barcodeSource: "SUPPLIER", barcode: supplierCode() },
        });
        expect(res.status).toBe(200);

        const isLast = index === variants.length - 1;
        expect(
          await inNotPrintedQueue(admin.token, created.id),
          isLast ? "with every size barcoded, nothing is owed" : "sizes still on our own code owe a label"
        ).toBe(!isLast);
      }

      // Which is also what the list row reports, so the screen can say so.
      const summary = await apiRequest<ProductSummaryDto[]>(
        `/api/products?printState=all&pageSize=100&q=${encodeURIComponent("Vitest Barcode")}`,
        { token: admin.token }
      );
      expect((summary.data ?? []).find((row) => row.id === created.id)?.needsLabel).toBe(false);
    });
  });
});

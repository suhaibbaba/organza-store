// ============================================================================
//  9. EDGE CASES
//
//    * two tills reaching for the last piece at the same moment: exactly one
//      sale succeeds, and stock lands on zero rather than below it;
//    * a duplicate SKU is refused, and every generated barcode is a unique,
//      valid EAN-13 (there is no way to hand one in, so uniqueness is what
//      there is to check);
//    * a numbered shawl's parent label is not a sellable thing: scanning it
//      offers the numbers, and an order that names no number is refused;
//    * a Palestinian number written on either prefix is the same line, and
//      the second one is a duplicate (+970 / +972, CLAUDE.md rule 18).
// ============================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId } from "@tests/support/fixtures";
import { createNumberedShawl } from "@tests/support/numbered";
import { randomPalestinePhone, samePhoneUnderOtherPrefix } from "@tests/support/phone";
import { expectCount } from "@tests/support/money";
import { createPricedProduct, readStock, sellRequest } from "@tests/support/verify";
import { CONCURRENT_BUYERS, SEEDED_PASSWORD, UNIT_PRICE } from "@tests/constants";
import type { ProductDto, ProductLookupDto } from "@tests/types";

// EAN-13's own check digit: the 13th is derived from the first 12, weighted
// 1,3,1,3,... A barcode that fails this would not scan in the shop.
function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

describe("Verify · edge cases", () => {
  let admin: string;

  beforeAll(async () => {
    admin = (await getSession("ADMIN")).token;
  });

  describe("the last piece on the shelf", () => {
    it("sells to exactly one of six tills reaching for it at the same moment", async () => {
      const product = await createPricedProduct(admin, { basePrice: UNIT_PRICE, stock: 1 });

      // Fired together, not one after another: the deduction has to be atomic
      // for this to come out at one, and a read-then-write would let several
      // through.
      const attempts = await Promise.all(
        Array.from({ length: CONCURRENT_BUYERS }, () =>
          sellRequest(admin, [{ productId: product.id, quantity: 1 }])
        )
      );

      const sold = attempts.filter((res) => res.status === 201);
      const refused = attempts.filter((res) => res.status === 409);

      expectCount(sold.length, 1, "sales that succeeded for the last piece");
      expectCount(refused.length, CONCURRENT_BUYERS - 1, "sales refused for want of stock");
      for (const res of refused) expect(res.error?.code).toBe("error.order.insufficient_stock");
      expectCount(await readStock(admin, product.id), 0, "stock afterwards (zero, never negative)");
    });

    it("sells exactly the three that are there when six ask for one each", async () => {
      const product = await createPricedProduct(admin, { basePrice: UNIT_PRICE, stock: 3 });

      const attempts = await Promise.all(
        Array.from({ length: CONCURRENT_BUYERS }, () =>
          sellRequest(admin, [{ productId: product.id, quantity: 1 }])
        )
      );

      expectCount(attempts.filter((res) => res.status === 201).length, 3, "sales that succeeded");
      expectCount(attempts.filter((res) => res.status === 409).length, CONCURRENT_BUYERS - 3, "sales refused");
      expectCount(await readStock(admin, product.id), 0, "stock afterwards");
    });
  });

  describe("identifiers stay unique", () => {
    it("refuses a SKU that is already on another product, and creates nothing", async () => {
      const existing = await createPricedProduct(admin);
      const categoryId = await anyCategoryId(admin);

      const clash = await apiRequest<ProductDto>("/api/products", {
        method: "POST",
        token: admin,
        body: {
          name: { ar: `مكرر ${uniqueId()}`, en: `[verify] duplicate sku ${uniqueId()}` },
          categoryId,
          basePrice: UNIT_PRICE,
          sku: existing.product.sku,
        },
      });

      expect(clash.status, "a SKU is unique across the shop").toBe(409);
      expect(clash.error?.code).toBe("error.sku.duplicate");
    });

    it("refuses to re-point an existing product's SKU at another one's", async () => {
      const first = await createPricedProduct(admin);
      const second = await createPricedProduct(admin);

      const res = await apiRequest(`/api/products/${second.id}`, {
        method: "PATCH",
        token: admin,
        body: { sku: first.product.sku },
      });
      expect(res.status).toBe(409);
      expect(res.error?.code).toBe("error.sku.duplicate");
    });

    it("generates a valid, unique EAN-13 for every product and variant", async () => {
      // There is no way to HAND a barcode in — neither the create nor the
      // update schema accepts one (CLAUDE.md rule 13: generated, never
      // scanned from the item) — so what there is to check is that what comes
      // out is a real barcode and never repeats.
      const created = await Promise.all([
        createPricedProduct(admin),
        createPricedProduct(admin),
        createPricedProduct(admin),
      ]);

      const barcodes = created.map((fixture) => fixture.product.barcode!);
      for (const barcode of barcodes) {
        expect(isValidEan13(barcode), `${barcode} must be a valid EAN-13 with a correct check digit`).toBe(true);
      }
      expectCount(new Set(barcodes).size, barcodes.length, "distinct barcodes among the three");

      // ...and each resolves to exactly its own product when scanned.
      for (const fixture of created) {
        const scan = await apiRequest<ProductLookupDto>(
          `/api/products/lookup?code=${encodeURIComponent(fixture.product.barcode!)}`,
          { token: admin }
        );
        expect(scan.status, "a scan must resolve").toBe(200);
        expect(scan.data!.product.id, "and resolve to the right product").toBe(fixture.id);
      }
    });

    it("refuses a barcode sent on creation instead of honouring it", async () => {
      const categoryId = await anyCategoryId(admin);
      const created = await apiRequest<ProductDto>("/api/products", {
        method: "POST",
        token: admin,
        body: {
          name: { ar: `باركود ${uniqueId()}`, en: `[verify] supplied barcode ${uniqueId()}` },
          categoryId,
          basePrice: UNIT_PRICE,
          barcode: "1234567890128",
        },
      });

      expect(created.status).toBe(201);
      expect(
        created.data!.barcode,
        "a client-supplied barcode must be ignored — barcodes are generated (CLAUDE.md rule 13)"
      ).not.toBe("1234567890128");
      expect(isValidEan13(created.data!.barcode!), "and the generated one is a valid EAN-13").toBe(true);
    });
  });

  describe("a numbered shawl's parent label is not a thing you can sell", () => {
    it("answers a scan of it with the list of numbers, and refuses a sale that names none", async () => {
      const shawl = await createNumberedShawl(admin, { basePrice: "60", stocks: [3, 2] });

      const scan = await apiRequest<ProductLookupDto>(
        `/api/products/lookup?code=${encodeURIComponent(shawl.product.barcode!)}`,
        { token: admin }
      );
      expect(scan.status).toBe(200);
      expect(scan.data!.kind, "the parent label asks which number").toBe("NUMBER_SELECTION");
      expect(scan.data!.variant, "and offers nothing sellable on its own").toBeNull();
      expectCount(scan.data!.numbers.length, 2, "numbers offered");

      const sold = await sellRequest(admin, [{ productId: shawl.product.id, quantity: 1 }]);
      expect(sold.status, "selling the parent without choosing a number must be refused").toBe(400);
      expect(sold.error?.code).toBe("error.order.variant_required");

      // And no number moved.
      expectCount(await readStock(admin, shawl.product.id, shawl.numbers[0].id), 3, "first number's stock");
      expectCount(await readStock(admin, shawl.product.id, shawl.numbers[1].id), 2, "second number's stock");
    });

    it("sells the number that was actually chosen, and leaves the others alone", async () => {
      const shawl = await createNumberedShawl(admin, { basePrice: "60", stocks: [3, 2] });
      const chosen = shawl.numbers[0];

      const scan = await apiRequest<ProductLookupDto>(
        `/api/products/lookup?code=${encodeURIComponent(chosen.barcode!)}`,
        { token: admin }
      );
      expect(scan.data!.kind, "one number's own label IS a sellable item").toBe("ITEM");
      expect(scan.data!.variant?.id).toBe(chosen.id);

      const sold = await sellRequest(admin, [
        { productId: shawl.product.id, variantId: chosen.id, quantity: 2 },
      ]);
      expect(sold.status).toBe(201);

      expectCount(await readStock(admin, shawl.product.id, chosen.id), 1, "the chosen number's stock");
      expectCount(await readStock(admin, shawl.product.id, shawl.numbers[1].id), 2, "the other number's stock");
    });
  });

  describe("a Palestinian number is one line, however it is written", () => {
    it("refuses the same number re-entered under the other prefix (+970 / +972)", async () => {
      const phone = randomPalestinePhone();
      const twin = samePhoneUnderOtherPrefix(phone);

      const first = await apiRequest<{ id: string }>("/api/users", {
        method: "POST",
        token: admin,
        body: {
          name: `[verify] staff ${uniqueId()}`,
          email: `verify-${uniqueId()}@organza.test`,
          password: SEEDED_PASSWORD,
          role: "EMPLOYEE",
          phone,
        },
      });
      expect(first.status, "the first number is accepted as entered").toBe(201);

      try {
        const second = await apiRequest("/api/users", {
          method: "POST",
          token: admin,
          body: {
            name: `[verify] staff ${uniqueId()}`,
            email: `verify-${uniqueId()}@organza.test`,
            password: SEEDED_PASSWORD,
            role: "EMPLOYEE",
            phone: twin,
          },
        });

        expect(second.status, `${twin} is the same line as ${phone}`).toBe(409);
        expect(second.error?.code).toBe("error.phone.duplicate");
      } finally {
        // A user cannot be deleted, so the one this test had to create is
        // deactivated instead — it must not stay able to sign in.
        await apiRequest(`/api/users/${first.data!.id}`, {
          method: "PATCH",
          token: admin,
          body: { isActive: false },
        });
      }
    });

    it("stores the number exactly as entered, without rewriting its prefix", async () => {
      // The prefix is what WhatsApp dials, so it is never normalised away.
      const phone = randomPalestinePhone("+972");

      const created = await apiRequest<{ id: string; phone: string }>("/api/users", {
        method: "POST",
        token: admin,
        body: {
          name: `[verify] staff ${uniqueId()}`,
          email: `verify-${uniqueId()}@organza.test`,
          password: SEEDED_PASSWORD,
          role: "EMPLOYEE",
          phone,
        },
      });

      try {
        expect(created.status).toBe(201);
        expect(created.data!.phone, "the number is kept on the prefix it was written on").toBe(phone);
      } finally {
        if (created.data?.id) {
          await apiRequest(`/api/users/${created.data.id}`, {
            method: "PATCH",
            token: admin,
            body: { isActive: false },
          });
        }
      }
    });

    it("refuses a number that is not a real phone number at all", async () => {
      for (const phone of ["not-a-phone", "+9705", "", "12345"]) {
        const res = await apiRequest("/api/users", {
          method: "POST",
          token: admin,
          body: {
            name: `[verify] staff ${uniqueId()}`,
            email: `verify-${uniqueId()}@organza.test`,
            password: SEEDED_PASSWORD,
            role: "EMPLOYEE",
            phone,
          },
        });
        expect(res.status, `${JSON.stringify(phone)} must be refused as a clean 400, never a 500`).toBe(400);
      }
    });
  });
});

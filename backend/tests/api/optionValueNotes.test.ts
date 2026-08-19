// What one option value MEANS on one product (spec.md "Notes on a product's
// options").
//
// The rule the whole feature rests on is the SCOPE: "S" is a different
// measurement on trousers than on an abaya, so a note written against one
// product's S must be invisible on every other product's S. Everything else
// here — the round trip, the languages, the number that reaches the POS — is
// only useful if that holds, so it is the first thing proved.
import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { anyCategoryId, twoByTwoOptionSelections } from "@tests/support/fixtures";
import { createNumberedShawl } from "@tests/support/numbered";
import type { OptionSelection, ProductDto, ProductLookupDto, ProductSummaryDto } from "@tests/types";
import { ERROR_CODES } from "@/constants";

async function createProduct(
  token: string,
  optionSelections: OptionSelection[],
  body: Record<string, unknown> = {}
): Promise<ProductDto> {
  const nonce = uniqueId();
  const name = `Vitest Notes ${nonce}`;
  const categoryId = await anyCategoryId(token);
  const res = await apiRequest<ProductDto>("/api/products", {
    method: "POST",
    token,
    body: {
      name: { ar: name, en: name },
      categoryId,
      basePrice: "100",
      optionSelections,
      ...body,
    },
  });
  if (res.status !== 201 || !res.data) {
    throw new Error(`Could not create a product for the notes tests (HTTP ${res.status}).`);
  }
  return res.data;
}

/** The note the API reports for one option value, as the screens read it. */
function noteOnValue(product: ProductDto, optionValueId: string) {
  for (const variant of product.variants) {
    const value = variant.values.find((candidate) => candidate.id === optionValueId);
    if (value) return value.note;
  }
  return undefined;
}

describe("Notes on a product's options", () => {
  const createdProductIds: string[] = [];

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of createdProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  it("scopes a note to the product that wrote it, never to the option value", async () => {
    const admin = await getSession("ADMIN");
    const selections = await twoByTwoOptionSelections(admin.token);
    const sharedSizeId = selections[1].valueIds[0];

    // Two products built on the very same global values — the size list is
    // the shop's one list, shared by the whole catalogue.
    const trousers = await createProduct(admin.token, selections, {
      optionValueNotes: [{ optionValueId: sharedSizeId, note: { ar: "طول البنطلون ٩٥ سم" } }],
    });
    createdProductIds.push(trousers.id);
    const abaya = await createProduct(admin.token, selections);
    createdProductIds.push(abaya.id);

    expect(noteOnValue(trousers, sharedSizeId)).toEqual({ ar: "طول البنطلون ٩٥ سم" });
    // The whole point: the same "S" on the next product says nothing.
    expect(noteOnValue(abaya, sharedSizeId)).toBeNull();
    expect(abaya.optionValueNotes).toEqual([]);

    // And the second product writing its own note leaves the first alone.
    const abayaNoted = await apiRequest<ProductDto>(`/api/products/${abaya.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { optionValueNotes: [{ optionValueId: sharedSizeId, note: { ar: "الطول ١٤٠ سم" } }] },
    });
    expect(noteOnValue(abayaNoted.data!, sharedSizeId)).toEqual({ ar: "الطول ١٤٠ سم" });

    const trousersAgain = await apiRequest<ProductDto>(`/api/products/${trousers.id}`, { token: admin.token });
    expect(noteOnValue(trousersAgain.data!, sharedSizeId)).toEqual({ ar: "طول البنطلون ٩٥ سم" });
  });

  it("round-trips a note through create and edit, and removes it on request", async () => {
    const admin = await getSession("ADMIN");
    const selections = await twoByTwoOptionSelections(admin.token);
    const colorId = selections[0].valueIds[0];
    const sizeId = selections[1].valueIds[0];

    const product = await createProduct(admin.token, selections, {
      optionValueNotes: [{ optionValueId: colorId, note: { ar: "قماش خفيف", en: "Light fabric" } }],
    });
    createdProductIds.push(product.id);
    expect(product.optionValueNotes).toHaveLength(1);
    expect(noteOnValue(product, colorId)).toEqual({ ar: "قماش خفيف", en: "Light fabric" });

    // A second note on another value, sent on its own: the first is not
    // mentioned in this request and must survive it.
    const edited = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { optionValueNotes: [{ optionValueId: sizeId, note: { ar: "الطول ١٤٠ سم" } }] },
    });
    expect(edited.status).toBe(200);
    expect(noteOnValue(edited.data!, colorId)).toEqual({ ar: "قماش خفيف", en: "Light fabric" });
    expect(noteOnValue(edited.data!, sizeId)).toEqual({ ar: "الطول ١٤٠ سم" });

    // Overwriting one replaces it outright rather than merging languages.
    const rewritten = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { optionValueNotes: [{ optionValueId: colorId, note: { ar: "قماش سميك" } }] },
    });
    expect(noteOnValue(rewritten.data!, colorId)).toEqual({ ar: "قماش سميك" });

    // Null removes it; blank in every language means the same thing.
    const cleared = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
      method: "PATCH",
      token: admin.token,
      body: {
        optionValueNotes: [
          { optionValueId: colorId, note: null },
          { optionValueId: sizeId, note: { ar: "   " } },
        ],
      },
    });
    expect(noteOnValue(cleared.data!, colorId)).toBeNull();
    expect(noteOnValue(cleared.data!, sizeId)).toBeNull();
    expect(cleared.data!.optionValueNotes).toEqual([]);
  });

  it("keeps only the languages that were written, so display can fall back", async () => {
    const admin = await getSession("ADMIN");
    const selections = await twoByTwoOptionSelections(admin.token);
    const sizeId = selections[1].valueIds[0];

    // The shop writes Arabic and nothing else, which is the normal case. The
    // empty English must not be stored as an empty string: every screen falls
    // back to the default language, and "" is not a missing translation, it
    // is a translation that renders blank.
    const product = await createProduct(admin.token, selections, {
      optionValueNotes: [{ optionValueId: sizeId, note: { ar: "الطول ١٤٠ سم", en: "", he: "" } }],
    });
    createdProductIds.push(product.id);

    const note = noteOnValue(product, sizeId) as Record<string, string>;
    expect(note.ar).toBe("الطول ١٤٠ سم");
    expect(note.en).toBeUndefined();
    expect(note.he).toBeUndefined();
  });

  it("refuses a note on an option value this product does not use", async () => {
    const admin = await getSession("ADMIN");
    const selections = await twoByTwoOptionSelections(admin.token);
    const colorOnly = [selections[0]];
    const unusedSizeId = selections[1].valueIds[0];

    const product = await createProduct(admin.token, colorOnly);
    createdProductIds.push(product.id);

    const res = await apiRequest(`/api/products/${product.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { optionValueNotes: [{ optionValueId: unusedSizeId, note: { ar: "لا مكان لها" } }] },
    });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe(ERROR_CODES.PRODUCT_OPTION_NOTE_VALUE_NOT_USED);

    // Refused at creation too — and with nothing created, rather than a 400
    // handed back for a product that exists anyway.
    const nonce = uniqueId();
    const categoryId = await anyCategoryId(admin.token);
    const query = `/api/products?pageSize=100&q=${encodeURIComponent(`Vitest Notes ${nonce}`)}`;
    const before = await apiRequest<ProductSummaryDto[]>(query, { token: admin.token });
    const created = await apiRequest(`/api/products`, {
      method: "POST",
      token: admin.token,
      body: {
        name: { ar: `Vitest Notes ${nonce}`, en: `Vitest Notes ${nonce}` },
        categoryId,
        basePrice: "100",
        optionSelections: colorOnly,
        optionValueNotes: [{ optionValueId: unusedSizeId, note: { ar: "لا مكان لها" } }],
      },
    });
    expect(created.status).toBe(400);
    const after = await apiRequest<ProductSummaryDto[]>(query, { token: admin.token });
    expect(after.data?.length ?? 0).toBe(before.data?.length ?? 0);
  });

  it("refuses a note longer than a note is meant to be", async () => {
    const admin = await getSession("ADMIN");
    const selections = await twoByTwoOptionSelections(admin.token);
    const product = await createProduct(admin.token, selections);
    createdProductIds.push(product.id);

    const res = await apiRequest(`/api/products/${product.id}`, {
      method: "PATCH",
      token: admin.token,
      body: {
        optionValueNotes: [{ optionValueId: selections[0].valueIds[0], note: { ar: "ط".repeat(200) } }],
      },
    });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
  });

  // A note is a product DETAIL — what the piece SAYS — so it rides on
  // product.edit exactly like the name beside it, and is not one of the five
  // actions held for approval (CLAUDE.md rule 21).
  it("lets an Employee write a note, while their price change on the same save still waits", async () => {
    const admin = await getSession("ADMIN");
    const employee = await getSession("EMPLOYEE");
    const selections = await twoByTwoOptionSelections(admin.token);
    const sizeId = selections[1].valueIds[0];

    const product = await createProduct(admin.token, selections);
    createdProductIds.push(product.id);

    const saved = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
      method: "PATCH",
      token: employee.token,
      body: {
        optionValueNotes: [{ optionValueId: sizeId, note: { ar: "الطول ١٤٠ سم" } }],
        basePrice: "999",
      },
    });

    expect(saved.status).toBe(200);
    // The note applied…
    expect(noteOnValue(saved.data!, sizeId)).toEqual({ ar: "الطول ١٤٠ سم" });
    // …and the price did not: it is waiting for an Admin instead.
    expect(Number(saved.data!.basePrice)).toBe(100);
    expect((saved.data!.pendingChanges ?? []).some((change) => change.field === "basePrice")).toBe(true);
  });

  // Numbers are option values like any other (spec.md "Numbered shawls"), so
  // a number takes a note like any other — and it reaches the POS beside the
  // number, never drawn on the photograph.
  it("carries a numbered shawl's note to the POS picker without touching the image overlay", async () => {
    const admin = await getSession("ADMIN");
    const employee = await getSession("EMPLOYEE");
    const { product, numbers } = await createNumberedShawl(admin.token, { stocks: [3, 2] });
    createdProductIds.push(product.id);

    const numberValueId = numbers[0].values[0].id;
    const withPoints = await apiRequest<ProductDto>(`/api/products/${product.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { optionValueNotes: [{ optionValueId: numberValueId, note: { ar: "حرير طبيعي" } }] },
    });
    expect(withPoints.status).toBe(200);

    // What the cashier gets when the collection label is scanned.
    const lookup = await apiRequest<ProductLookupDto>(
      `/api/products/lookup?code=${encodeURIComponent(product.barcode!)}`,
      { token: employee.token }
    );
    expect(lookup.status).toBe(200);

    const numbered = lookup.data!.numbers.find((option) => option.variantId === numbers[0].id);
    expect(numbered?.note).toEqual({ ar: "حرير طبيعي" });
    // The other number carries none, and says so plainly rather than by
    // omission — a screen must be able to draw nothing without guessing.
    expect(lookup.data!.numbers.find((option) => option.variantId === numbers[1].id)?.note).toBeNull();

    // The picker reads the same note off the variant it is about to sell.
    const pickerValue = lookup
      .data!.product.variants.find((variant) => variant.id === numbers[0].id)
      ?.values.find((value) => value.id === numberValueId);
    expect(pickerValue?.note).toEqual({ ar: "حرير طبيعي" });

    // And nothing about the photograph moved: the points are where they were
    // and the markers' colours were not touched, because a note is never
    // drawn on the image.
    const reloaded = await apiRequest<ProductDto>(`/api/products/${product.id}`, { token: admin.token });
    const before = numbers[0];
    const after = reloaded.data!.variants.find((variant) => variant.id === before.id);
    expect(after?.imageX ?? null).toEqual(before.imageX ?? null);
    expect(after?.imageY ?? null).toEqual(before.imageY ?? null);
    expect(reloaded.data!.pointTextColor).toBeNull();
    expect(reloaded.data!.pointBackgroundColor).toBeNull();
  });
});

// Fixture lookups against data the seed guarantees exists (backend/prisma/dev/demo-seed.ts):
// nested categories, and the global "color"/"size"/"number" variant types
// with >=2 values each.
import { apiRequest } from "@tests/support/client";
import type { OptionSelection, VariantTypeDto } from "@tests/types";

export async function anyCategoryId(token: string): Promise<string> {
  const res = await apiRequest<{ id: string }[]>("/api/categories?flat=true", { token });
  if (!res.success || !res.data?.length) {
    throw new Error("No categories available — ensure the target API has been seeded via `npm run seed`.");
  }
  return res.data[0].id;
}

// A category that is NOT the one given — for proving that moving a product
// between categories leaves its SKU alone (CLAUDE.md rule 1). The seed nests
// several, so there is always a second one; if there somehow isn't, the
// caller gets the same id back and the assertion still holds, just weaker.
export async function anotherCategoryId(token: string, notId: string): Promise<string> {
  const res = await apiRequest<{ id: string }[]>("/api/categories?flat=true", { token });
  const categories = res.data ?? [];
  if (!categories.length) {
    throw new Error("No categories available — ensure the target API has been seeded via `npm run seed`.");
  }
  return (categories.find((category) => category.id !== notId) ?? categories[0]).id;
}

// Two option types x two values each = a 2x2 cartesian product (4 variants),
// reusing the seeded "color" and "size" types instead of creating new global
// variant types on every run.
export async function twoByTwoOptionSelections(token: string): Promise<OptionSelection[]> {
  const res = await apiRequest<VariantTypeDto[]>("/api/variant-types", { token });
  if (!res.success || !res.data) {
    throw new Error("Could not load variant types — ensure the target API has been seeded via `npm run seed`.");
  }
  const bySlug = new Map(res.data.map((t) => [t.slug, t]));
  const color = bySlug.get("color");
  const size = bySlug.get("size");
  if (!color || !size || color.values.length < 2 || size.values.length < 2) {
    throw new Error("Seeded 'color' and 'size' variant types with >=2 values each are required for this test.");
  }
  return [
    { variantTypeId: color.id, valueIds: [color.values[0].id, color.values[1].id] },
    { variantTypeId: size.id, valueIds: [size.values[0].id, size.values[1].id] },
  ];
}

// The seeded global "number" variant type (spec.md: numbered shawls reuse it
// as-is), with its first two option value ids.
export async function firstTwoNumberValueIds(token: string): Promise<{ variantTypeId: string; valueIds: [string, string] }> {
  const res = await apiRequest<VariantTypeDto[]>("/api/variant-types", { token });
  if (!res.success || !res.data) {
    throw new Error("Could not load variant types — ensure the target API has been seeded via `npm run seed`.");
  }
  const number = res.data.find((t) => t.slug === "number");
  if (!number || number.values.length < 2) {
    throw new Error("Seeded 'number' variant type with >=2 values is required for this test.");
  }
  return { variantTypeId: number.id, valueIds: [number.values[0].id, number.values[1].id] };
}

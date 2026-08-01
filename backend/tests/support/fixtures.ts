// Fixture lookups against data the seed guarantees exists (backend/prisma/seed.ts):
// nested categories, and the global "color"/"size" variant types with >=2 values each.
import { apiRequest } from "@tests/support/client";
import type { OptionSelection, VariantTypeDto } from "@tests/types";

export async function anyCategoryId(token: string): Promise<string> {
  const res = await apiRequest<{ id: string }[]>("/api/categories?flat=true", { token });
  if (!res.success || !res.data?.length) {
    throw new Error("No categories available — ensure the target API has been seeded via `npm run seed`.");
  }
  return res.data[0].id;
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

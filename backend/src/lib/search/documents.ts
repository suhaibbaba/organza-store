import { SUPPORTED_LANGUAGES } from "@store/shared/constants/languages";
import { normalize, normalizedValues, withArticleVariants } from "@/lib/search/normalize";
import type { SearchCategoryNode, ProductSearchDocument, SearchProductRow } from "@/types/search";

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const searchable = (values: string[]) => withArticleVariants(unique(values).join(" "));

// The product's category and every parent above it, in every language: "عبايات" also finds pieces filed under it.
function categoryNames(categoryId: string | null, categories: Map<string, SearchCategoryNode>): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let current = categoryId ? categories.get(categoryId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.push(...normalizedValues(current.name));
    current = current.parentId ? categories.get(current.parentId) : undefined;
  }
  return names;
}

export function toSearchDocument(
  row: SearchProductRow,
  categories: Map<string, SearchCategoryNode>,
): ProductSearchDocument {
  const name = (row.name ?? {}) as Record<string, unknown>;
  const names = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((lang) => {
      const value = name[lang];
      return [`name_${lang}`, typeof value === "string" ? withArticleVariants(normalize(value)) : ""];
    }),
  );
  const inStock = row.variants.length ? row.variants.some((v) => v.stock > 0) : row.stock > 0;

  return {
    id: row.id,
    ...names,
    sku: unique([row.sku ?? "", ...row.variants.map((v) => v.sku)]),
    barcode: unique([row.barcode ?? "", ...row.variants.map((v) => v.barcode ?? "")]),
    category: searchable(categoryNames(row.categoryId, categories)),
    attributes: searchable(
      row.variants.flatMap((v) => [
        ...normalizedValues(v.name),
        ...v.values.flatMap((value) => normalizedValues(value.optionValue.value)),
      ]),
    ),
    description: searchable(normalizedValues(row.description)),
    categoryId: row.categoryId,
    isActive: row.isActive,
    inStock,
    price: Number(row.basePrice),
    image: row.images[0]?.thumbnailUrl ?? null,
    createdAt: row.createdAt.getTime(),
  };
}

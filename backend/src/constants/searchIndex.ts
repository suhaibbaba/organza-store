// The products index as code, applied by npm run search:setup and every reindex; bump PRODUCTS_INDEX_VERSION on change.
import { SUPPORTED_LANGUAGES } from "@store/shared/constants/languages";

export const PRODUCTS_INDEX_VERSION = 3;

export const PRODUCT_NAME_FIELDS = SUPPORTED_LANGUAGES.map((lang) => `name_${lang}`);
export const CODE_FIELDS = ["sku", "barcode"] as const;

export const PRODUCTS_INDEX_SETTINGS = {
  // Order is importance: a hit in the name outranks the same hit in the description.
  searchableAttributes: [...PRODUCT_NAME_FIELDS, ...CODE_FIELDS, "category", "attributes", "description"],
  filterableAttributes: ["categoryId", "isActive", "inStock", "price"],
  sortableAttributes: ["price", "createdAt"],
  rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
  typoTolerance: {
    enabled: true,
    // Arabic garment words are short: one typo from 4 letters (شيفن → شيفون), two from 8.
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    // A code is matched exactly; ORG-00042 must never find ORG-00043.
    disableOnAttributes: [...CODE_FIELDS],
    disableOnNumbers: true,
  },
  pagination: { maxTotalHits: 1000 },
} as const;

// Words the shop treats as the same, written as typed (normalized before applying): a word and what it should also find.
export const PRODUCT_SYNONYMS: Record<string, string[]> = {
  عباية: ["عباءة"],
  عباءة: ["عباية"],
  جاكيت: ["جاكت", "جكيت"],
  جاكت: ["جاكيت", "جكيت"],
  جكيت: ["جاكيت", "جاكت"],
  بنطلون: ["بنطال"],
  بنطال: ["بنطلون"],
};

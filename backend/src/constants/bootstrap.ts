import type { I18n } from "@/types/common";

// The data a real, empty Organza database needs before anybody can use it.
//
// This is NOT sample data. There are no products here, no orders, no
// accounts — only the lists the app cannot function without: the store
// settings singleton, the global option types a product is built from, and
// the categories an expense is filed under. Everything the shop actually
// sells is typed in by the shop.
//
// Each entry is created ONCE in the life of a database (see
// lib/bootstrap.ts): retiring a colour or a category is a decision, and a
// bootstrap that re-upserted "what should exist" would quietly undo it on the
// next deploy.

/** Marker keys written to BootstrapRecord. Namespaced so a new group can never collide with an old one. */
export const BOOTSTRAP_KEYS = {
  setting: () => "setting:default",
  variantType: (slug: string) => `variantType:${slug}`,
  variantValue: (typeSlug: string, key: string) => `variantValue:${typeSlug}:${key}`,
  expenseCategory: (key: string) => `expenseCategory:${key}`,
  // One marker per (role, action), not one for the whole table. Same reason
  // every other default here has its own: the shop switching an Employee's
  // stock permission off is a DECISION, and a single "permissions seeded"
  // marker would let the next release — which adds an action and therefore
  // has rows to write — put every earlier decision back.
  rolePermission: (role: string, action: string) => `rolePermission:${role}:${action}`,
} as const;

export const SETTING_SINGLETON_ID = "default";

/** Store-wide defaults. Every one of them is editable from the admin's Settings screen afterwards. */
export const BOOTSTRAP_SETTING = {
  storeName: { ar: "أورجانزا", en: "Organza", he: "אורגנזה" } as I18n,
  defaultLanguage: "ar",
  supportedLanguages: ["ar", "en", "he"],
  currency: "ILS",
  defaultCountryCode: "+970",
  lowStockThreshold: 3,
  saleNotificationsEnabled: true,
  // Mirrors SALE_NOTIFICATION_DEFAULTS in shared/src/constants/push.ts — one
  // notification per sale (spec.md "Sale notifications").
  saleNotificationMode: "EVERY_SALE" as const,
  saleNotificationMinAmount: "0",
};

export interface BootstrapVariantType {
  slug: string;
  name: I18n;
  values: { key: string; value: I18n }[];
}

/**
 * The three global option types (spec.md "Variant Types & Values"), each with
 * a starting set the shop extends inline from the product form. "Number" is
 * an ordinary type carrying numeric sizes; a numbered shawl's 1, 2, 3… are
 * added to it by the numbered-points editor as they are drawn.
 */
export const BOOTSTRAP_VARIANT_TYPES: BootstrapVariantType[] = [
  {
    slug: "color",
    name: { ar: "اللون", en: "Color", he: "צבע" },
    values: [
      { key: "black", value: { ar: "أسود", en: "Black", he: "שחור" } },
      { key: "white", value: { ar: "أبيض", en: "White", he: "לבן" } },
      { key: "beige", value: { ar: "بيج", en: "Beige", he: "בז'" } },
      { key: "red", value: { ar: "أحمر", en: "Red", he: "אדום" } },
      { key: "blue", value: { ar: "أزرق", en: "Blue", he: "כחול" } },
      { key: "green", value: { ar: "أخضر", en: "Green", he: "ירוק" } },
    ],
  },
  {
    slug: "size",
    name: { ar: "المقاس", en: "Size", he: "מידה" },
    values: [
      { key: "s", value: { ar: "S", en: "S", he: "S" } },
      { key: "m", value: { ar: "M", en: "M", he: "M" } },
      { key: "l", value: { ar: "L", en: "L", he: "L" } },
      { key: "xl", value: { ar: "XL", en: "XL", he: "XL" } },
      { key: "xxl", value: { ar: "XXL", en: "XXL", he: "XXL" } },
    ],
  },
  {
    slug: "number",
    name: { ar: "الأرقام", en: "Number", he: "מספר" },
    values: ["36", "38", "40", "42", "44", "46"].map((n) => ({
      key: n,
      value: { ar: n, en: n, he: n },
    })),
  },
];

/** The shop's own expense list (spec.md "Expense categories") — extendable from the admin. */
export const BOOTSTRAP_EXPENSE_CATEGORIES: { key: string; name: I18n }[] = [
  { key: "utilities", name: { ar: "فواتير", en: "Utilities", he: "חשבונות" } },
  { key: "salaries", name: { ar: "رواتب", en: "Salaries", he: "משכורות" } },
  { key: "supplies", name: { ar: "مستلزمات", en: "Supplies", he: "ציוד" } },
  { key: "maintenance", name: { ar: "صيانة", en: "Maintenance", he: "תחזוקה" } },
  { key: "delivery", name: { ar: "توصيل", en: "Delivery", he: "משלוחים" } },
];

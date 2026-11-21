import type { TypographyVariant } from "@store/ui";
// Token names only; values come from the stylesheet so swatches never drift.
export const DESIGN_SYSTEM_COLOUR_GROUPS = [
  {
    key: "palette",
    tokens: [
      "primary-50", "primary-100", "primary-200", "primary-300", "primary-500",
      "primary-600", "primary-700", "primary-800", "primary-900",
      "success-50", "success-100", "success-300", "success-500", "success-700", "success-900",
      "warning-50", "warning-100", "warning-300", "warning-500", "warning-700", "warning-800",
      "danger-50", "danger-100", "danger-200", "danger-500", "danger-600", "danger-800",
      "neutral-50", "neutral-100", "neutral-200", "neutral-300", "neutral-400",
      "neutral-500", "neutral-600", "neutral-700", "neutral-900",
    ],
  },
  {
    key: "surfaces",
    tokens: [
      "canvas", "surface", "inset", "sunken", "rail", "rail-ink", "rail-hover", "rail-active", "row-hover", "table-head",
      "quiet-bg", "selected", "selected-line", "line", "line-strong",
    ],
  },
  {
    key: "ink",
    tokens: ["ink", "ink-muted", "ink-subtle", "ink-faint", "quiet-ink", "ink-inverse"],
  },
  {
    key: "tints",
    tokens: [
      "tint-1-bg", "tint-1-ink", "tint-2-bg", "tint-2-ink", "tint-3-bg", "tint-3-ink",
      "tint-4-bg", "tint-4-ink", "tint-5-bg", "tint-5-ink", "tint-6-bg", "tint-6-ink",
    ],
  },
] as const;

export const DESIGN_SYSTEM_TYPOGRAPHY_VARIANTS = [
  "display",
  "h1",
  "h2",
  "h3",
  "h4",
  "body",
  "small",
  "caption",
  "label",
] as const satisfies readonly TypographyVariant[];

export const DESIGN_SYSTEM_TYPE_SCALE = [
  "micro", "meta", "label", "value", "section", "heading", "title", "kpi",
] as const;

export const DESIGN_SYSTEM_RADII = [
  "chip", "control", "field", "nav", "card", "panel", "brand", "pill",
] as const;

export const DESIGN_SYSTEM_SHADOWS = [
  "pill", "card", "card-hover", "float", "nav-active", "glass",
] as const;

// The sample table's rows: ids and figures only; the names are messages.
export const DESIGN_SYSTEM_SAMPLE_ROWS = [
  { id: "a", nameKey: "rowA", sku: "ORG-1042", stock: 12, price: "180.00" },
  { id: "b", nameKey: "rowB", sku: "ORG-1043-2", stock: 2, price: "240.00" },
  { id: "c", nameKey: "rowC", sku: "ORG-1051", stock: 0, price: "35.00" },
] as const;


// Long enough (over 10) that the Select turns searchable on its own.
export const DESIGN_SYSTEM_COLOURS = ["black", "white", "navy", "beige", "camel", "grey", "olive", "burgundy", "rose", "sky", "mint", "mustard"] as const;

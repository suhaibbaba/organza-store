import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

export const FONT_SIZE_KEYS = [
  "micro",
  "meta",
  "label",
  "value",
  "section",
  "heading",
  "title",
  "kpi",
  "field",
] as const;

export const LEADING_KEYS = [
  "micro",
  "meta",
  "label",
  "value",
  "section",
  "heading",
  "title",
  "kpi",
  "field",
] as const;

export const RADIUS_KEYS = [
  "brand",
  "card",
  "chip",
  "control",
  "field",
  "nav",
  "panel",
  "pill",
] as const;

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZE_KEYS] }],
      leading: [{ leading: [...LEADING_KEYS] }],
      rounded: [{ rounded: [...RADIUS_KEYS] }],
    },
  },
});

export const cn = (...values: ClassValue[]): string => merge(clsx(values));

import type { BreadcrumbLeafKind } from "@/types/layout";

// Path segments that name an action rather than a record id.
export const BREADCRUMB_ACTION_SEGMENTS: Readonly<Record<string, BreadcrumbLeafKind>> = {
  new: "new",
  edit: "edit",
};

// Sections whose leaves have their own wording ("Order details"); the rest use the generic one.
export const BREADCRUMB_SECTIONS: Readonly<Record<string, readonly BreadcrumbLeafKind[]>> = {
  orders: ["detail", "new"],
  products: ["detail", "new", "edit"],
  customers: ["detail"],
  suppliers: ["detail"],
};

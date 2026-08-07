// Mirrors the DTO built by backend/src/lib/changeRequests.ts's
// serializeChangeRequest — the generic approval record every gated change in
// the shop goes through (spec.md "Employee change approvals").

export interface ChangeRequestValueDto {
  kind: "money" | "count" | "flag" | "variantSet" | "deletion" | "approval";
  value: string | number | boolean | null;
  detail?: {
    action?: "add" | "remove";
    variants?: { id?: string; sku?: string | null; name: Record<string, string> }[];
    optionSelections?: { variantTypeId: string; valueIds: string[] }[];
    variantId?: string;
  };
}

export interface ChangeRequestDto {
  id: string;
  entityType: "Product" | "Variant" | "ProductImage" | "Expense";
  entityId: string;
  field: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  oldValue: ChangeRequestValueDto | null;
  newValue: ChangeRequestValueDto | null;
  entityLabel: Record<string, string> | null;
  /** The owning product's name — what the approval screen heads the card with. */
  productLabel: Record<string, string> | null;
  entityDetail: string | null;
  productId: string | null;
  requestedById: string;
  requestedBy: { id: string; name: string } | null;
  requestedAt: string;
  decidedById: string | null;
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

/** GET /api/change-requests/count — what the nav badge reads. */
export interface ChangeRequestCountDto {
  pending: number;
}

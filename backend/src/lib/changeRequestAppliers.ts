import { AuditAction, Prisma } from "@prisma/client";
import { AppError } from "@/lib/response";
import { deleteProductImageFiles } from "@/lib/image";
import { generateVariantsForProduct, validateOptionSelections } from "@/lib/variants";
import {
  APPROVED_EXPENSE_APPROVAL_STATUS,
  AUDIT_ENTITY,
  CHANGE_REQUEST_ENTITIES,
  CHANGE_REQUEST_FIELDS,
  CHANGE_REQUEST_VARIANT_SET_ACTIONS,
  ERROR_CODES,
  PENDING_EXPENSE_APPROVAL_STATUS,
  REJECTED_EXPENSE_APPROVAL_STATUS,
} from "@/constants";
import type {
  AppliedChangeRequestRow,
  ChangeRequestValue,
  ChangeRequestValueDetail,
  DbClient,
} from "@/types/changeRequest";
import type { ExpenseApprovalStatus } from "@/types";
import type { PermissionAction } from "@store/shared/types/permission";

// What "approve" does per gated field, inside the approval's transaction: throwing leaves it pending.

/** The audit entries an application wants written, minus the actor. */
export type ApplierAudit = Omit<import("@/types").AuditEntry, "userId">;

export interface ApplyOutcome {
  audits: ApplierAudit[];
  /** Post-commit work that cannot roll back (deleting image files), so a failed approval never destroys the photo. */
  afterCommit?: () => Promise<void>;
}

/** Who decided, and when — the same values written onto the request row. */
export interface ApplyContext {
  deciderId: string;
  decidedAt: Date;
}

export interface ChangeRequestApplier {
  /** Applies the requested value. */
  apply: (tx: DbClient, request: AppliedChangeRequestRow, ctx: ApplyContext) => Promise<ApplyOutcome>;
  /** Optional: what a refusal must write; only an expense needs it, or it would sit pending forever. */
  reject?: (tx: DbClient, request: AppliedChangeRequestRow, ctx: ApplyContext) => Promise<ApplyOutcome>;
  /** Optional: may the asker decide their own request? Never for a gate; only quick sell's `completion`, which is data entry. */
  allowSelfDecision?: boolean;
}

function requestedValue(request: AppliedChangeRequestRow): ChangeRequestValue {
  const value = request.newValue as ChangeRequestValue | null;
  if (!value) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
  }
  return value;
}

function requestedDetail(request: AppliedChangeRequestRow): ChangeRequestValueDetail {
  const detail = requestedValue(request).detail;
  if (!detail) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
  }
  return detail;
}

// A live product or a refusal; soft-deleted counts as gone.
async function liveProduct(tx: DbClient, id: string) {
  const product = await tx.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);
  }
  return product;
}

async function liveVariant(tx: DbClient, id: string) {
  const variant = await tx.variant.findFirst({ where: { id, product: { deletedAt: null } } });
  if (!variant) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);
  }
  return variant;
}

// --- products --------------------------------------------------------------

// A money field on the product (basePrice or the "was" price), audited as PRICE_CHANGE.
function productMoneyApplier(field: "basePrice" | "compareAtPrice"): ChangeRequestApplier {
  return {
    apply: async (tx, request) => {
      const product = await liveProduct(tx, request.entityId);
      const raw = requestedValue(request).value;
      const next = raw === null ? null : new Prisma.Decimal(String(raw));
      await tx.product.update({ where: { id: product.id }, data: { [field]: next } });
      return {
        audits: [
          {
            action: AuditAction.PRICE_CHANGE,
            entityType: AUDIT_ENTITY.PRODUCT,
            entityId: product.id,
            oldValue: { [field]: product[field] },
            newValue: { [field]: next },
          },
        ],
      };
    },
  };
}

const productStockApplier: ChangeRequestApplier = {
  apply: async (tx, request) => {
    const product = await liveProduct(tx, request.entityId);
    // Stock moved to the variants meanwhile: the parent's own stock is ignored on a variant-bearing product.
    const variantCount = await tx.variant.count({ where: { productId: product.id } });
    if (variantCount > 0) {
      throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
    }

    const stock = Number(requestedValue(request).value);
    await tx.product.update({ where: { id: product.id }, data: { stock } });
    return {
      audits: [
        {
          action: AuditAction.STOCK_CHANGE,
          entityType: AUDIT_ENTITY.PRODUCT,
          entityId: product.id,
          oldValue: { stock: product.stock },
          newValue: { stock },
        },
      ],
    };
  },
};

const productVisibilityApplier: ChangeRequestApplier = {
  apply: async (tx, request) => {
    const product = await liveProduct(tx, request.entityId);
    const isActive = Boolean(requestedValue(request).value);
    await tx.product.update({ where: { id: product.id }, data: { isActive } });
    return {
      audits: [
        {
          action: isActive ? AuditAction.PUBLISH : AuditAction.HIDE,
          entityType: AUDIT_ENTITY.PRODUCT,
          entityId: product.id,
          oldValue: { isActive: product.isActive },
          newValue: { isActive },
        },
      ],
    };
  },
};

// The product's variant set: adding and removing are one field, so a newer request supersedes rather than queues.
const productVariantSetApplier: ChangeRequestApplier = {
  apply: async (tx, request) => {
    const detail = requestedDetail(request);
    const product = await liveProduct(tx, request.entityId);

    if (detail.action === CHANGE_REQUEST_VARIANT_SET_ACTIONS.REMOVE) {
      if (!detail.variantId) {
        throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
      }
      const variant = await tx.variant.findFirst({
        where: { id: detail.variantId, productId: product.id },
      });
      // Already gone — nothing left to approve, and saying so beats pretending the approval did something.
      if (!variant) {
        throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);
      }

      await tx.variant.delete({ where: { id: variant.id } });
      return {
        audits: [
          {
            action: AuditAction.DELETE,
            entityType: AUDIT_ENTITY.VARIANT,
            entityId: variant.id,
            oldValue: variant,
          },
        ],
      };
    }

    if (!detail.optionSelections?.length) {
      throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
    }

    // Re-validated at approval: option values are stored as ids and resolved against what they say now (rule 2).
    const valueMap = await validateOptionSelections(detail.optionSelections, product.isNumbered, tx);
    const full = await tx.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { variants: { include: { values: true } } },
    });
    const { createdSkus } = await generateVariantsForProduct(
      tx,
      full,
      detail.optionSelections,
      valueMap,
      detail.comboStocks,
    );

    return {
      audits: [
        {
          action: AuditAction.CREATE,
          entityType: AUDIT_ENTITY.VARIANT,
          entityId: product.id,
          newValue: { generatedSkus: createdSkus },
        },
      ],
    };
  },
};

// --- variants --------------------------------------------------------------

const variantPriceApplier: ChangeRequestApplier = {
  apply: async (tx, request) => {
    const variant = await liveVariant(tx, request.entityId);
    const raw = requestedValue(request).value;
    // Null is a real answer: clearing the override makes the variant inherit the parent's price (rule 3).
    const priceOverride = raw === null ? null : new Prisma.Decimal(String(raw));
    await tx.variant.update({ where: { id: variant.id }, data: { priceOverride } });
    return {
      audits: [
        {
          action: AuditAction.PRICE_CHANGE,
          entityType: AUDIT_ENTITY.VARIANT,
          entityId: variant.id,
          oldValue: { priceOverride: variant.priceOverride },
          newValue: { priceOverride },
        },
      ],
    };
  },
};

const variantStockApplier: ChangeRequestApplier = {
  apply: async (tx, request) => {
    const variant = await liveVariant(tx, request.entityId);
    const stock = Number(requestedValue(request).value);
    await tx.variant.update({ where: { id: variant.id }, data: { stock } });
    return {
      audits: [
        {
          action: AuditAction.STOCK_CHANGE,
          entityType: AUDIT_ENTITY.VARIANT,
          entityId: variant.id,
          oldValue: { stock: variant.stock },
          newValue: { stock },
        },
      ],
    };
  },
};

// --- quick sell (spec.md "Quick sell") --------------------------------------

// Quick sell's completion reads backwards: approving completes the product, refusing rules it a one-off; the order is untouched.
const productCompletionApplier: ChangeRequestApplier = {
  // See allowSelfDecision above: reviewing your own quick sale is data entry, not self-approval.
  allowSelfDecision: true,

  apply: async (tx, request, ctx) => {
    const product = await liveProduct(tx, request.entityId);
    if (!product.quickSoldAt || product.completedAt) {
      throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
    }
    // Completing requires a category, or the product vanishes from every category list; cost, barcode and photos stay optional.
    if (!product.categoryId) {
      throw new AppError(409, ERROR_CODES.PRODUCT_COMPLETION_INCOMPLETE);
    }

    await tx.product.update({
      where: { id: product.id },
      data: {
        completedAt: ctx.decidedAt,
        // A quick-sold product is created hidden; completing it is what publishes it.
        isActive: true,
      },
    });

    return {
      audits: [
        {
          action: AuditAction.UPDATE,
          entityType: AUDIT_ENTITY.PRODUCT,
          entityId: product.id,
          oldValue: { quickSoldAt: product.quickSoldAt, completedAt: null, isActive: product.isActive },
          newValue: { completedAt: ctx.decidedAt, isActive: true },
        },
      ],
    };
  },

  // "One-off" is NOT an undo: the sale and money stay; the product is soft-deleted (rule 4), leaving the completing queue.
  reject: async (tx, request, ctx) => {
    const product = await liveProduct(tx, request.entityId);
    if (!product.quickSoldAt || product.completedAt) {
      throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
    }

    await tx.product.update({
      where: { id: product.id },
      data: { oneOffAt: ctx.decidedAt, deletedAt: ctx.decidedAt, isActive: false },
    });

    return {
      audits: [
        {
          action: AuditAction.DELETE,
          entityType: AUDIT_ENTITY.PRODUCT,
          entityId: product.id,
          oldValue: { quickSoldAt: product.quickSoldAt, oneOffAt: null, deletedAt: null },
          newValue: { oneOffAt: ctx.decidedAt, deletedAt: ctx.decidedAt },
        },
      ],
    };
  },
};

// --- images ----------------------------------------------------------------

const imageDeletionApplier: ChangeRequestApplier = {
  apply: async (tx, request) => {
    const image = await tx.productImage.findUnique({ where: { id: request.entityId } });
    if (!image) {
      throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);
    }

    await tx.productImage.delete({ where: { id: image.id } });
    return {
      audits: [
        {
          action: AuditAction.DELETE,
          entityType: AUDIT_ENTITY.PRODUCT_IMAGE,
          entityId: image.id,
          oldValue: image,
        },
      ],
      // Files are deleted only after commit, so a rolled-back approval never points at missing photos.
      afterCommit: () => deleteProductImageFiles(image.filename, image.originalFilename),
    };
  },
};

// --- expenses --------------------------------------------------------------

// Expense approval: approvalStatus/approvedBy stay as the applied state every money query filters on.
async function decideExpense(
  tx: DbClient,
  request: AppliedChangeRequestRow,
  ctx: ApplyContext,
  status: ExpenseApprovalStatus,
): Promise<ApplyOutcome> {
  const expense = await tx.expense.findFirst({ where: { id: request.entityId, deletedAt: null } });
  if (!expense) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);
  }
  // Deciding a non-pending expense would overwrite who signed off what, so it is refused.
  if (expense.approvalStatus !== PENDING_EXPENSE_APPROVAL_STATUS) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
  }

  await tx.expense.update({
    where: { id: expense.id },
    data: { approvalStatus: status, approvedById: ctx.deciderId, approvedAt: ctx.decidedAt },
  });

  return {
    audits: [
      {
        action: status === APPROVED_EXPENSE_APPROVAL_STATUS ? AuditAction.APPROVE : AuditAction.REJECT,
        entityType: AUDIT_ENTITY.EXPENSE,
        entityId: expense.id,
        oldValue: { approvalStatus: expense.approvalStatus },
        newValue: { approvalStatus: status, approvedById: ctx.deciderId, approvedAt: ctx.decidedAt },
      },
    ],
  };
}

const expenseApprovalApplier: ChangeRequestApplier = {
  apply: (tx, request, ctx) =>
    decideExpense(tx, request, ctx, APPROVED_EXPENSE_APPROVAL_STATUS as ExpenseApprovalStatus),
  // Refusing an expense writes REJECTED on its own row, with who refused it.
  reject: (tx, request, ctx) =>
    decideExpense(tx, request, ctx, REJECTED_EXPENSE_APPROVAL_STATUS as ExpenseApprovalStatus),
};

// The registry: gating a new field is one entry here plus an applier above.
const APPLIERS: Record<string, ChangeRequestApplier> = {
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_BASE_PRICE}`]: productMoneyApplier("basePrice"),
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_COMPARE_AT_PRICE}`]:
    productMoneyApplier("compareAtPrice"),
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_STOCK}`]: productStockApplier,
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_IS_ACTIVE}`]: productVisibilityApplier,
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_VARIANT_SET}`]: productVariantSetApplier,
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_COMPLETION}`]: productCompletionApplier,

  [`${CHANGE_REQUEST_ENTITIES.VARIANT}:${CHANGE_REQUEST_FIELDS.VARIANT_PRICE_OVERRIDE}`]: variantPriceApplier,
  [`${CHANGE_REQUEST_ENTITIES.VARIANT}:${CHANGE_REQUEST_FIELDS.VARIANT_STOCK}`]: variantStockApplier,

  [`${CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE}:${CHANGE_REQUEST_FIELDS.IMAGE_DELETION}`]: imageDeletionApplier,

  [`${CHANGE_REQUEST_ENTITIES.EXPENSE}:${CHANGE_REQUEST_FIELDS.EXPENSE_APPROVAL}`]: expenseApprovalApplier,
};

/** The applier for a stored request, or a refusal. */
export function applierFor(entityType: string, field: string): ChangeRequestApplier {
  const applier = APPLIERS[`${entityType}:${field}`];
  if (!applier) {
    throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
  }
  return applier;
}

/** Is this (entity, field) pair gated at all? Used by the filing side. */
export function isGatedField(entityType: string, field: string): boolean {
  return Boolean(APPLIERS[`${entityType}:${field}`]);
}

/** Which permission decides this request: changeRequest.approve, except quick sell's completion, decided by product.complete. */
const DECISION_PERMISSIONS: Record<string, PermissionAction> = {
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_COMPLETION}`]: "product.complete",
};

export function decisionPermissionFor(entityType: string, field: string): PermissionAction {
  return DECISION_PERMISSIONS[`${entityType}:${field}`] ?? "changeRequest.approve";
}

/** Every action that can decide something — what the list and count endpoints check before showing others' requests. */
export const DECIDER_PERMISSIONS: readonly PermissionAction[] = [
  "changeRequest.approve",
  ...Object.values(DECISION_PERMISSIONS),
];

/** The (entityType, field) pairs a given decider permission covers. */
export function fieldsDecidableBy(action: PermissionAction): { entityType: string; field: string }[] {
  return Object.entries(DECISION_PERMISSIONS)
    .filter(([, permission]) => permission === action)
    .map(([key]) => {
      const [entityType, field] = key.split(":");
      return { entityType, field };
    });
}

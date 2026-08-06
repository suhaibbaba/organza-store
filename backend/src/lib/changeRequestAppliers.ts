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

// ============================================================================
//  What "approve" actually DOES, per gated field.
//
//  This is the only place that knows how to turn a request back into a write.
//  Everything else in the flow — filing, superseding, listing, deciding,
//  auditing — is entity-agnostic, which is what makes gating a new field a
//  matter of adding one entry to the table at the bottom of this file.
//
//  Every applier runs inside the approval's transaction. Throwing therefore
//  leaves the request pending and the entity untouched, which is the honest
//  outcome when the thing being changed has moved on since it was asked for.
// ============================================================================

/** The audit entries an application wants written, minus the actor. */
export type ApplierAudit = Omit<import("@/types").AuditEntry, "userId">;

export interface ApplyOutcome {
  audits: ApplierAudit[];
  /**
   * Work that must NOT be inside the transaction — deleting the image files
   * off disk, which cannot be rolled back. Runs only once the change is
   * committed, so a failed approval never destroys the photo it was about.
   */
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
  /**
   * Optional: what a REFUSAL has to write, when discarding the request alone
   * would leave the entity stuck. Only expenses need it — an expense that is
   * turned down has to say so on its own row, or it sits "pending" forever.
   * Everything else is discarded by doing precisely nothing.
   */
  reject?: (tx: DbClient, request: AppliedChangeRequestRow, ctx: ApplyContext) => Promise<ApplyOutcome>;
}

function requestedValue(request: AppliedChangeRequestRow): ChangeRequestValue {
  const value = request.newValue as ChangeRequestValue | null;
  if (!value) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
  return value;
}

function requestedDetail(request: AppliedChangeRequestRow): ChangeRequestValueDetail {
  const detail = requestedValue(request).detail;
  if (!detail) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
  return detail;
}

// A live product, or a refusal. Soft-deleted counts as gone: approving a
// price for a product that has since been deleted would resurrect a decision
// about something nobody can sell.
async function liveProduct(tx: DbClient, id: string) {
  const product = await tx.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);
  return product;
}

async function liveVariant(tx: DbClient, id: string) {
  const variant = await tx.variant.findFirst({ where: { id, product: { deletedAt: null } } });
  if (!variant) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);
  return variant;
}

// --- products --------------------------------------------------------------

// A money field on the product: basePrice, or the "was" price beside it.
// Both are PRICE_CHANGE in the trail, which is the question anyone asks of it.
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
    // Stock moved to the variants while the request waited: the number asked
    // for no longer means anything, since the parent's own stock is ignored
    // on a variant-bearing product.
    const variantCount = await tx.variant.count({ where: { productId: product.id } });
    if (variantCount > 0) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);

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

// Which variants the product has. One field for both directions — adding
// combinations and removing one are the same question, so a second request
// supersedes the first rather than queueing behind it.
const productVariantSetApplier: ChangeRequestApplier = {
  apply: async (tx, request) => {
    const detail = requestedDetail(request);
    const product = await liveProduct(tx, request.entityId);

    if (detail.action === CHANGE_REQUEST_VARIANT_SET_ACTIONS.REMOVE) {
      if (!detail.variantId) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
      const variant = await tx.variant.findFirst({
        where: { id: detail.variantId, productId: product.id },
      });
      // Already gone — nothing left to approve, and saying so beats pretending
      // the approval did something.
      if (!variant) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);

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

    if (!detail.optionSelections?.length) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);

    // Re-validated at approval time, not trusted from when it was asked for:
    // an option value may have been removed in the meantime, and the request
    // stores ids rather than copied text precisely so this resolves against
    // whatever those values say now (CLAUDE.md rule 2).
    const valueMap = await validateOptionSelections(detail.optionSelections, product.isNumbered, tx);
    const full = await tx.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { variants: { include: { values: true } } },
    });
    const { createdSkus } = await generateVariantsForProduct(tx, full, detail.optionSelections, valueMap);

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
    // Null is a real answer here, not a missing one: clearing the override is
    // what makes the variant inherit its parent's price again (CLAUDE.md rule 3).
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

// --- images ----------------------------------------------------------------

const imageDeletionApplier: ChangeRequestApplier = {
  apply: async (tx, request) => {
    const image = await tx.productImage.findUnique({ where: { id: request.entityId } });
    if (!image) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);

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
      // The files go only once the row is committed — a rolled-back approval
      // must never leave a product pointing at photos that no longer exist.
      afterCommit: () => deleteProductImageFiles(image.filename),
    };
  },
};

// --- expenses --------------------------------------------------------------

// The approval that used to be POST /api/expenses/:id/approve. The expense's
// own approvalStatus/approvedBy columns stay: they are the APPLIED state, and
// every money query in the shop already filters on them ("only approved
// expenses count"). What moved is the request — the thing an Admin acts on —
// so there is one approval mechanism rather than two.
async function decideExpense(
  tx: DbClient,
  request: AppliedChangeRequestRow,
  ctx: ApplyContext,
  status: ExpenseApprovalStatus
): Promise<ApplyOutcome> {
  const expense = await tx.expense.findFirst({ where: { id: request.entityId, deletedAt: null } });
  if (!expense) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_TARGET_MISSING);
  // Deciding one that is no longer pending is not a no-op: it would silently
  // overwrite who signed off what, which is the one thing the record exists
  // to hold (the rule the old /approve endpoint enforced, kept intact).
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
  // The one field where refusing has to write something: an expense turned
  // down is REJECTED on its own row, with who turned it down, rather than
  // sitting pending forever (spec.md "Expenses").
  reject: (tx, request, ctx) =>
    decideExpense(tx, request, ctx, REJECTED_EXPENSE_APPROVAL_STATUS as ExpenseApprovalStatus),
};

// ---------------------------------------------------------------------------
//  The registry. Gating a new field is one line here plus an applier above —
//  no new table, no new endpoint, no new approval screen.
// ---------------------------------------------------------------------------
const APPLIERS: Record<string, ChangeRequestApplier> = {
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_BASE_PRICE}`]:
    productMoneyApplier("basePrice"),
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_COMPARE_AT_PRICE}`]:
    productMoneyApplier("compareAtPrice"),
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_STOCK}`]: productStockApplier,
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_IS_ACTIVE}`]: productVisibilityApplier,
  [`${CHANGE_REQUEST_ENTITIES.PRODUCT}:${CHANGE_REQUEST_FIELDS.PRODUCT_VARIANT_SET}`]: productVariantSetApplier,

  [`${CHANGE_REQUEST_ENTITIES.VARIANT}:${CHANGE_REQUEST_FIELDS.VARIANT_PRICE_OVERRIDE}`]: variantPriceApplier,
  [`${CHANGE_REQUEST_ENTITIES.VARIANT}:${CHANGE_REQUEST_FIELDS.VARIANT_STOCK}`]: variantStockApplier,

  [`${CHANGE_REQUEST_ENTITIES.PRODUCT_IMAGE}:${CHANGE_REQUEST_FIELDS.IMAGE_DELETION}`]: imageDeletionApplier,

  [`${CHANGE_REQUEST_ENTITIES.EXPENSE}:${CHANGE_REQUEST_FIELDS.EXPENSE_APPROVAL}`]: expenseApprovalApplier,
};

/**
 * The applier for a stored request, or a refusal. A row whose field has since
 * been un-gated has nothing to apply — better to say so than to guess.
 */
export function applierFor(entityType: string, field: string): ChangeRequestApplier {
  const applier = APPLIERS[`${entityType}:${field}`];
  if (!applier) throw new AppError(409, ERROR_CODES.CHANGE_REQUEST_NOT_APPLICABLE);
  return applier;
}

/** Is this (entity, field) pair gated at all? Used by the filing side. */
export function isGatedField(entityType: string, field: string): boolean {
  return Boolean(APPLIERS[`${entityType}:${field}`]);
}

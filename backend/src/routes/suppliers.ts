import { Router } from "express";
import { AuditAction } from "@prisma/client";
import { can } from "@store/shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { writeAudit } from "@/lib/audit";
import { money, roundMoney, ZERO_MONEY } from "@/lib/money";
import {
  assertSupplierPhoneFree,
  listSuppliers,
  loadSupplierDetail,
  paySupplier,
  serializeInvoice,
  serializeSupplier,
} from "@/lib/suppliers";
import {
  createSupplierInvoiceSchema,
  createSupplierSchema,
  listSuppliersQuerySchema,
  supplierPaymentSchema,
  updateSupplierInvoiceSchema,
  updateSupplierSchema,
  type CreateSupplierInput,
  type CreateSupplierInvoiceInput,
  type ListSuppliersQuery,
  type SupplierPaymentBody,
  type UpdateSupplierInput,
  type UpdateSupplierInvoiceInput,
} from "@/validation/supplier";
import { AUDIT_ENTITY, ERROR_CODES, MONEY_DECIMAL_PLACES } from "@/constants";
import type { SupplierPaymentResult } from "@/types";

// Suppliers, their invoices and what the shop has paid them (spec.md "Suppliers and their invoices").
const router = Router();
router.use(requireAuth);

const INVOICE_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  _count: { select: { payments: true } },
} as const;

// A calendar date stored as midnight UTC, so it reads back as the same day everywhere.
function invoiceDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function findInvoice(supplierId: string, invoiceId: string) {
  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id: invoiceId, supplierId, deletedAt: null },
    include: INVOICE_INCLUDE,
  });
  if (!invoice) {
    throw new AppError(404, ERROR_CODES.SUPPLIER_INVOICE_NOT_FOUND);
  }
  return invoice;
}

// GET /api/suppliers — paginated, each with what the shop owes them, plus the shop-wide total.
router.get(
  "/",
  requirePermission("supplier.view"),
  validateQuery(listSuppliersQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListSuppliersQuery;
    const { rows, total, meta } = await listSuppliers(query);
    sendOk(res, rows, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      ...meta,
    });
  }),
);

// POST /api/suppliers
router.post(
  "/",
  requirePermission("supplier.manage"),
  validateBody(createSupplierSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateSupplierInput;
    if (body.phone) {
      await assertSupplierPhoneFree(prisma, body.phone);
    }
    const created = await prisma.supplier.create({
      data: {
        name: body.name,
        phone: body.phone ?? null,
        whatsapp: body.whatsapp ?? null,
        address: body.address ?? null,
        note: body.note ?? null,
        createdById: req.user!.id,
      },
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.SUPPLIER,
      entityId: created.id,
      newValue: serializeSupplier(created),
    });
    sendOk(res, serializeSupplier(created), null, 201);
  }),
);

// GET /api/suppliers/:id — balance, invoices and payments.
router.get(
  "/:id",
  requirePermission("supplier.view"),
  asyncHandler(async (req, res) => {
    sendOk(res, await loadSupplierDetail(req.params.id));
  }),
);

// PATCH /api/suppliers/:id
router.patch(
  "/:id",
  requirePermission("supplier.manage"),
  validateBody(updateSupplierSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as UpdateSupplierInput;
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError(404, ERROR_CODES.SUPPLIER_NOT_FOUND);
    }
    if (body.phone && body.phone !== existing.phone) {
      await assertSupplierPhoneFree(prisma, body.phone, existing.id);
    }
    const updated = await prisma.supplier.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        phone: body.phone,
        whatsapp: body.whatsapp,
        address: body.address,
        note: body.note,
      },
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.SUPPLIER,
      entityId: updated.id,
      oldValue: serializeSupplier(existing),
      newValue: serializeSupplier(updated),
    });
    sendOk(res, serializeSupplier(updated));
  }),
);

// POST /api/suppliers/:id/invoices — what was paid on the spot is the invoice's first payment.
router.post(
  "/:id/invoices",
  requirePermission("supplier.manage"),
  validateBody(createSupplierInvoiceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateSupplierInvoiceInput;
    const supplierId = req.params.id;
    const total = roundMoney(money(body.total));
    const paidNow = roundMoney(money(body.paidNow ?? 0));
    if (paidNow.greaterThan(total)) {
      throw new AppError(400, ERROR_CODES.SUPPLIER_PAYMENT_EXCEEDS_BALANCE);
    }
    // Paying on the spot is a payment, so it needs supplier.pay as well.
    if (paidNow.greaterThan(0) && !can(req.user!, "supplier.pay")) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN);
    }

    const { invoice, paymentId } = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
      if (!supplier) {
        throw new AppError(404, ERROR_CODES.SUPPLIER_NOT_FOUND);
      }
      const created = await tx.supplierInvoice.create({
        data: {
          supplierId,
          invoiceNumber: body.invoiceNumber ?? null,
          invoiceDate: invoiceDay(body.invoiceDate),
          total,
          paidAmount: paidNow,
          note: body.note ?? null,
          createdById: req.user!.id,
        },
      });
      const payment = paidNow.greaterThan(0)
        ? await tx.supplierPayment.create({
            data: {
              supplierId,
              invoiceId: created.id,
              amount: paidNow,
              fromDrawer: body.paidFromDrawer === true,
              paidById: req.user!.id,
            },
          })
        : null;
      const invoice = await tx.supplierInvoice.findUniqueOrThrow({
        where: { id: created.id },
        include: INVOICE_INCLUDE,
      });
      return { invoice, paymentId: payment?.id ?? null };
    });

    const row = serializeInvoice(invoice);
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.SUPPLIER_INVOICE,
      entityId: invoice.id,
      newValue: { ...row, supplierId },
    });
    if (paymentId) {
      await writeAudit({
        userId: req.user!.id,
        action: AuditAction.PAYMENT_MADE,
        entityType: AUDIT_ENTITY.SUPPLIER_INVOICE,
        entityId: invoice.id,
        newValue: {
          paymentId,
          amount: paidNow.toFixed(MONEY_DECIMAL_PLACES),
          fromDrawer: body.paidFromDrawer === true,
          balance: row.balance,
          supplierId,
        },
      });
    }
    sendOk(res, row, null, 201);
  }),
);

// PATCH /api/suppliers/:id/invoices/:invoiceId — a total can never drop below what is already paid.
router.patch(
  "/:id/invoices/:invoiceId",
  requirePermission("supplier.manage"),
  validateBody(updateSupplierInvoiceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as UpdateSupplierInvoiceInput;
    const existing = await findInvoice(req.params.id, req.params.invoiceId);
    const total = body.total === undefined ? undefined : roundMoney(money(body.total));
    if (total && total.lessThan(existing.paidAmount)) {
      throw new AppError(409, ERROR_CODES.SUPPLIER_INVOICE_BELOW_PAID);
    }
    const updated = await prisma.supplierInvoice.update({
      where: { id: existing.id },
      data: {
        invoiceNumber: body.invoiceNumber,
        invoiceDate: body.invoiceDate ? invoiceDay(body.invoiceDate) : undefined,
        total,
        note: body.note,
      },
      include: INVOICE_INCLUDE,
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.SUPPLIER_INVOICE,
      entityId: updated.id,
      oldValue: serializeInvoice(existing),
      newValue: serializeInvoice(updated),
    });
    sendOk(res, serializeInvoice(updated));
  }),
);

// DELETE /api/suppliers/:id/invoices/:invoiceId — soft, and only while nothing has been paid on it.
router.delete(
  "/:id/invoices/:invoiceId",
  requirePermission("supplier.manage"),
  asyncHandler(async (req, res) => {
    const existing = await findInvoice(req.params.id, req.params.invoiceId);
    if (existing._count.payments > 0 || existing.paidAmount.greaterThan(ZERO_MONEY())) {
      throw new AppError(409, ERROR_CODES.SUPPLIER_INVOICE_HAS_PAYMENTS);
    }
    const deleted = await prisma.supplierInvoice.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.SUPPLIER_INVOICE,
      entityId: existing.id,
      oldValue: serializeInvoice(existing),
      newValue: { deletedAt: deleted.deletedAt },
    });
    sendOk(res, { id: existing.id });
  }),
);

// POST /api/suppliers/:id/payments — one invoice or oldest first; `preview` shows the split without saving.
router.post(
  "/:id/payments",
  requirePermission("supplier.pay"),
  validateBody(supplierPaymentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as SupplierPaymentBody;
    const save = !body.preview;
    const outcome = await prisma.$transaction((tx) =>
      paySupplier(tx, req.params.id, {
        amount: body.amount,
        fromDrawer: body.fromDrawer,
        invoiceId: body.invoiceId,
        note: body.note,
        userId: req.user!.id,
        save,
      }),
    );

    if (save) {
      for (const [index, recorded] of outcome.recorded.entries()) {
        const allocation = outcome.allocations[index];
        await writeAudit({
          userId: req.user!.id,
          action: AuditAction.PAYMENT_MADE,
          entityType: AUDIT_ENTITY.SUPPLIER_INVOICE,
          entityId: recorded.invoiceId,
          oldValue: { balance: allocation.balanceBefore },
          newValue: {
            paymentId: recorded.paymentId,
            amount: recorded.amount.toFixed(MONEY_DECIMAL_PLACES),
            fromDrawer: body.fromDrawer,
            balance: allocation.balanceAfter,
            supplierId: req.params.id,
          },
        });
      }
    }

    const result: SupplierPaymentResult = {
      allocations: outcome.allocations,
      preview: !save,
      balance: outcome.balance.toFixed(MONEY_DECIMAL_PLACES),
    };
    sendOk(res, result, null, save ? 201 : 200);
  }),
);

export default router;

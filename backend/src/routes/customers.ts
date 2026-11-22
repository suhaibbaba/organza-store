import { Router } from "express";
import { AuditAction } from "@prisma/client";
import { can } from "@store/shared/lib/permissions";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody, validateQuery } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { writeAudit } from "@/lib/audit";
import {
  assertPhoneFree,
  listCustomers,
  loadCustomerDetail,
  payCustomerDebt,
  serializeCustomer,
} from "@/lib/customers";
import {
  createCustomerSchema,
  customerPaymentSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type CustomerPaymentInput,
  type ListCustomersQuery,
  type UpdateCustomerInput,
} from "@/validation/customer";
import { AUDIT_ENTITY, ERROR_CODES, MONEY_DECIMAL_PLACES } from "@/constants";
import type { CustomerPaymentResult } from "@/types";

// Customers and their accounts (spec.md "Customers and selling on credit").
const router = Router();
router.use(requireAuth);

// GET /api/customers — paginated, with each balance; the shop-wide debt total only with dashboard.view (rule 19).
router.get(
  "/",
  requirePermission("customer.view"),
  validateQuery(listCustomersQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.validatedQuery as ListCustomersQuery;
    const { rows, total, meta } = await listCustomers(query, can(req.user!, "dashboard.view"));
    sendOk(res, rows, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      ...meta,
    });
  }),
);

// POST /api/customers
router.post(
  "/",
  requirePermission("customer.manage"),
  validateBody(createCustomerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CreateCustomerInput;
    await assertPhoneFree(prisma, body.phone);
    const created = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone,
        whatsapp: body.whatsapp ?? null,
        address: body.address ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        note: body.note ?? null,
        createdById: req.user!.id,
      },
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.CUSTOMER,
      entityId: created.id,
      newValue: serializeCustomer(created),
    });
    sendOk(res, serializeCustomer(created), null, 201);
  }),
);

// GET /api/customers/:id — balance, kept pieces, orders and payments.
router.get(
  "/:id",
  requirePermission("customer.view"),
  asyncHandler(async (req, res) => {
    sendOk(res, await loadCustomerDetail(req.params.id));
  }),
);

// PATCH /api/customers/:id — past orders keep their own snapshot; only the customer's card changes.
router.patch(
  "/:id",
  requirePermission("customer.manage"),
  validateBody(updateCustomerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as UpdateCustomerInput;
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError(404, ERROR_CODES.CUSTOMER_NOT_FOUND);
    }
    if (body.phone && body.phone !== existing.phone) {
      await assertPhoneFree(prisma, body.phone, existing.id);
    }
    const updated = await prisma.customer.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        phone: body.phone,
        whatsapp: body.whatsapp,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        note: body.note,
      },
    });
    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.CUSTOMER,
      entityId: updated.id,
      oldValue: serializeCustomer(existing),
      newValue: serializeCustomer(updated),
    });
    sendOk(res, serializeCustomer(updated));
  }),
);

// POST /api/customers/:id/payments — one payment spread oldest order first; `preview` shows the split without saving.
router.post(
  "/:id/payments",
  requirePermission("order.recordPayment"),
  validateBody(customerPaymentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as CustomerPaymentInput;
    const save = !body.preview;
    const outcome = await prisma.$transaction((tx) =>
      payCustomerDebt(tx, req.params.id, { amount: body.amount, note: body.note, userId: req.user!.id, save }),
    );

    if (save) {
      for (const [index, recorded] of outcome.recorded.entries()) {
        const allocation = outcome.allocations[index];
        await writeAudit({
          userId: req.user!.id,
          action: AuditAction.PAYMENT_RECEIVED,
          entityType: AUDIT_ENTITY.ORDER,
          entityId: allocation.orderId,
          oldValue: { balance: allocation.balanceBefore },
          newValue: {
            paymentId: recorded.paymentId,
            amount: recorded.amount.toFixed(MONEY_DECIMAL_PLACES),
            balance: allocation.balanceAfter,
            paymentStatus: recorded.paymentStatus,
            customerId: req.params.id,
          },
        });
      }
    }

    const result: CustomerPaymentResult = {
      allocations: outcome.allocations,
      preview: !save,
      balance: outcome.balance.toFixed(MONEY_DECIMAL_PLACES),
    };
    sendOk(res, result, null, save ? 201 : 200);
  }),
);

export default router;

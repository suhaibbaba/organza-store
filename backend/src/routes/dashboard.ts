import { Router } from "express";
import { Prisma } from "@prisma/client";
import { can } from "@shared/lib/permissions";
import type { DashboardSummary } from "@shared/types/dashboard";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { sendOk } from "@/lib/response";
import { DEFAULT_LOW_STOCK_THRESHOLD, SETTINGS_SINGLETON_ID } from "@/constants";

// Phase 1 dashboard (spec.md) — built only from data that already exists
// (Products, Variants, Categories, Setting). No Orders yet, so no
// sales/profit numbers here (that's Phase 2).
const router = Router();
router.use(requireAuth);

router.get(
  "/summary",
  requirePermission("dashboard.view"),
  asyncHandler(async (req, res) => {
    const canViewCost = can(req.user!, "product.viewCost");

    const [activeCount, hiddenCount, categoryCount, setting, products] = await Promise.all([
      prisma.product.count({ where: { deletedAt: null, isActive: true } }),
      prisma.product.count({ where: { deletedAt: null, isActive: false } }),
      prisma.category.count(),
      prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID } }),
      prisma.product.findMany({
        where: { deletedAt: null },
        select: {
          stock: true,
          basePrice: true,
          cost: true,
          trackLowStock: true,
          variants: { select: { stock: true, priceOverride: true, cost: true } },
        },
      }),
    ]);

    const threshold = setting?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    let lowStockCount = 0;
    let inventoryValue = new Prisma.Decimal(0);

    // Inventory value covers every product; the low-stock count only counts
    // products that opted into tracking (Product.trackLowStock), so the alert
    // isn't drowned out by the many one-off pieces that sit at stock = 1.
    for (const product of products) {
      if (product.variants.length === 0) {
        if (product.trackLowStock && product.stock <= threshold) lowStockCount += 1;
        const unitPrice = canViewCost ? (product.cost ?? product.basePrice) : product.basePrice;
        inventoryValue = inventoryValue.add(unitPrice.mul(product.stock));
        continue;
      }
      for (const variant of product.variants) {
        if (product.trackLowStock && variant.stock <= threshold) lowStockCount += 1;
        const unitPrice = canViewCost
          ? (variant.cost ?? product.cost ?? variant.priceOverride ?? product.basePrice)
          : (variant.priceOverride ?? product.basePrice);
        inventoryValue = inventoryValue.add(unitPrice.mul(variant.stock));
      }
    }

    const summary: DashboardSummary = {
      products: {
        active: activeCount,
        hidden: hiddenCount,
        total: activeCount + hiddenCount,
      },
      categories: { total: categoryCount },
      lowStock: { count: lowStockCount, threshold },
      inventoryValue: {
        amount: inventoryValue.toString(),
        basis: canViewCost ? "cost" : "price",
      },
    };

    sendOk(res, summary);
  })
);

export default router;

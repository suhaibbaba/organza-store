import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { sendOk } from "../lib/response";

// Read-only for Phase 2 — full nested category CRUD is a later build-order
// stage (spec.md stage 4). This just lets the product flow list/validate
// categoryId.
const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { createdAt: "asc" } });
    sendOk(res, categories);
  })
);

export default router;

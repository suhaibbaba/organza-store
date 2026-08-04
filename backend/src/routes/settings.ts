import { Router } from "express";
import { AuditAction, type Setting } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth, requirePermission } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { updateSettingSchema, type UpdateSettingInput } from "@/validation/setting";
import { writeAudit } from "@/lib/audit";
import { AUDIT_ENTITY, ERROR_CODES, SETTINGS_SINGLETON_ID } from "@/constants";

// Singleton Setting row (CLAUDE.md rule 14) — readable by any authed user
// (currency/language/threshold are needed broadly), writable by Admin only.
const router = Router();
router.use(requireAuth);

async function getOrCreateSettings() {
  return prisma.setting.upsert({
    where: { id: SETTINGS_SINGLETON_ID },
    update: {},
    create: { id: SETTINGS_SINGLETON_ID, storeName: { ar: "المتجر", en: "Store", he: "חנות" } },
  });
}

// Money leaves the API as a fixed-2dp string like it does everywhere else,
// rather than as whatever Decimal's own JSON form happens to be.
function serializeSetting(setting: Setting) {
  return { ...setting, saleNotificationMinAmount: formatMoney(setting.saleNotificationMinAmount) };
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    sendOk(res, serializeSetting(await getOrCreateSettings()));
  })
);

router.patch(
  "/",
  requirePermission("settings.manage"),
  validateBody(updateSettingSchema),
  asyncHandler(async (req, res) => {
    const existing = await getOrCreateSettings();
    const body = req.body as UpdateSettingInput;

    const effectiveSupported = body.supportedLanguages ?? existing.supportedLanguages;
    const effectiveDefault = body.defaultLanguage ?? existing.defaultLanguage;
    if (!effectiveSupported.includes(effectiveDefault)) {
      throw new AppError(400, ERROR_CODES.SETTING_DEFAULT_LANGUAGE_NOT_SUPPORTED);
    }

    const updated = await prisma.setting.update({
      where: { id: SETTINGS_SINGLETON_ID },
      data: {
        storeName: body.storeName,
        defaultLanguage: body.defaultLanguage,
        supportedLanguages: body.supportedLanguages,
        currency: body.currency,
        defaultCountryCode: body.defaultCountryCode,
        lowStockThreshold: body.lowStockThreshold,
        // Barcode-label geometry (CLAUDE.md rule 13/14): the sheet lives in
        // settings so any printer the shop owns can be described, and nothing
        // about it is hard-coded in the apps that render the labels.
        labelPrintMode: body.labelPrintMode,
        labelWidthMm: body.labelWidthMm,
        labelHeightMm: body.labelHeightMm,
        labelColumns: body.labelColumns,
        labelRows: body.labelRows,
        labelPageMarginTopMm: body.labelPageMarginTopMm,
        labelPageMarginRightMm: body.labelPageMarginRightMm,
        labelPageMarginBottomMm: body.labelPageMarginBottomMm,
        labelPageMarginLeftMm: body.labelPageMarginLeftMm,
        labelGapXMm: body.labelGapXMm,
        labelGapYMm: body.labelGapYMm,
        // Sale notifications (Admin-only, like the rest of this screen): the
        // master switch, which sales are worth a notification, and the
        // threshold the ABOVE_AMOUNT mode will read once it exists.
        saleNotificationsEnabled: body.saleNotificationsEnabled,
        saleNotificationMode: body.saleNotificationMode,
        saleNotificationMinAmount: body.saleNotificationMinAmount,
      },
    });

    await writeAudit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.SETTING,
      entityId: updated.id,
      oldValue: existing,
      newValue: updated,
    });

    sendOk(res, serializeSetting(updated));
  })
);

export default router;

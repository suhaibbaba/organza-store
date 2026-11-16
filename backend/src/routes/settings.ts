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

// Named field by field rather than spread, and that is the whole point.
//
// This used to be `{ ...setting }`, on a route every signed-in role can read.
// Nothing on the model is sensitive today — currency, languages, the low-stock
// threshold and the label geometry all have to be broadly readable (CLAUDE.md
// rule 14) — but an allow-everything serializer on a table an Admin edits
// means the NEXT column added here reaches every Employee by default, with no
// code change and nobody deciding it should. That is the exact shape of the
// leak this file's neighbours were audited for: a screen that quietly carried
// a figure it was never meant to.
//
// Adding a field to `Setting` now requires adding it here too, which is the
// moment to ask whether everyone may see it.
//
// Money leaves the API as a fixed-2dp string like it does everywhere else,
// rather than as whatever Decimal's own JSON form happens to be.
function serializeSetting(setting: Setting) {
  return {
    id: setting.id,
    storeName: setting.storeName,
    defaultLanguage: setting.defaultLanguage,
    supportedLanguages: setting.supportedLanguages,
    currency: setting.currency,
    defaultCountryCode: setting.defaultCountryCode,
    lowStockThreshold: setting.lowStockThreshold,

    // Barcode-label geometry — read by every screen that prints a label.
    labelPrintMode: setting.labelPrintMode,
    labelWidthMm: setting.labelWidthMm,
    labelHeightMm: setting.labelHeightMm,
    labelColumns: setting.labelColumns,
    labelRows: setting.labelRows,
    labelPageMarginTopMm: setting.labelPageMarginTopMm,
    labelPageMarginRightMm: setting.labelPageMarginRightMm,
    labelPageMarginBottomMm: setting.labelPageMarginBottomMm,
    labelPageMarginLeftMm: setting.labelPageMarginLeftMm,
    labelGapXMm: setting.labelGapXMm,
    labelGapYMm: setting.labelGapYMm,

    // Sale notifications.
    saleNotificationsEnabled: setting.saleNotificationsEnabled,
    saleNotificationMode: setting.saleNotificationMode,
    saleNotificationMinAmount: formatMoney(setting.saleNotificationMinAmount),

    updatedAt: setting.updatedAt,
  };
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

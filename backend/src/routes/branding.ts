import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { sendOk } from "@/lib/response";
import { asyncHandler } from "@/middleware/asyncHandler";
import { faviconUrls, logoUrl } from "@/lib/image";
import { BOOTSTRAP_SETTING, SETTINGS_SINGLETON_ID } from "@/constants";
import type { Branding } from "@store/shared/types/setting";
import type { I18n } from "@/types/common";

// GET /api/branding — open: a tab, a home-screen icon and the login page draw it before anyone signs in.
const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const setting = await prisma.setting.findUnique({
      where: { id: SETTINGS_SINGLETON_ID },
      select: { storeName: true, logoFilename: true, faviconFilename: true },
    });
    const branding: Branding = {
      storeName: (setting?.storeName as I18n | null) ?? BOOTSTRAP_SETTING.storeName,
      logoUrl: logoUrl(setting?.logoFilename ?? null),
      faviconUrls: faviconUrls(setting?.faviconFilename ?? null),
    };
    sendOk(res, branding);
  })
);

export default router;

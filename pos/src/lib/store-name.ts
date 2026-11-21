import { getLocale, getTranslations } from "next-intl/server";
import { localizeI18n } from "@store/shared/lib/i18n";
import { fetchBranding } from "@/lib/branding";

// Server side: the shop's name for a signed-out screen, or the system's name when the API cannot say.
export async function storeDisplayName(): Promise<string> {
  const [branding, locale, tApp] = await Promise.all([fetchBranding(), getLocale(), getTranslations("app")]);
  return localizeI18n(branding?.storeName, locale) || tApp("name");
}

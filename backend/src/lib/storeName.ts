import { localizeI18n } from "@store/shared/lib/i18n";
import { prisma } from "@/lib/prisma";
import { BOOTSTRAP_SETTING, SETTINGS_SINGLETON_ID } from "@/constants";
import type { I18n, SupportedLanguage } from "@/types/common";

// The shop's own name lives in Settings, never in code: the system serves more than one shop.
export async function loadStoreName(): Promise<I18n> {
  const setting = await prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID }, select: { storeName: true } });
  return (setting?.storeName as I18n | null) ?? BOOTSTRAP_SETTING.storeName;
}

export function storeNameIn(storeName: I18n, language: SupportedLanguage): string {
  return localizeI18n(storeName, language) || localizeI18n(BOOTSTRAP_SETTING.storeName, language);
}

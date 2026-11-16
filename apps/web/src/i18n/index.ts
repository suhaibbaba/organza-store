import { DEFAULT_LANGUAGE, isRtl, LANGUAGES, type Language } from '@organza/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { safeStorage } from '@web/shared/lib/safe-storage';
import ar from './locales/ar.json';

const LANGUAGE_KEY = 'organza.language';
const loaders: Record<
  Exclude<Language, 'ar'>,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  en: () => import('./locales/en.json'),
  he: () => import('./locales/he.json'),
};

export function storedLanguage(): Language {
  const value = safeStorage.get(LANGUAGE_KEY);
  return (LANGUAGES as readonly string[]).includes(value ?? '')
    ? (value as Language)
    : DEFAULT_LANGUAGE;
}

function applyDocument(language: Language): void {
  document.documentElement.lang = language;
  document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr';
}

export async function setLanguage(language: Language): Promise<void> {
  if (language !== 'ar' && !i18n.hasResourceBundle(language, 'translation')) {
    const bundle = await loaders[language]();
    i18n.addResourceBundle(language, 'translation', bundle.default, true, true);
  }
  await i18n.changeLanguage(language);
  safeStorage.set(LANGUAGE_KEY, language);
  applyDocument(language);
}

export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources: { ar: { translation: ar } },
    lng: 'ar',
    fallbackLng: 'ar',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  await setLanguage(storedLanguage());
}

export { i18n };

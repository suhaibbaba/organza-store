import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ar from './ar.json'
import { loadSettings } from '@/lib/storage'

const saved = loadSettings().language || 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: saved,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n

export function isRTL(lang: string): boolean {
  return lang === 'ar'
}

export function applyDirection(lang: string): void {
  const dir = isRTL(lang) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
}

// Apply direction immediately on load
applyDirection(saved)

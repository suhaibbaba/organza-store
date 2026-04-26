// ─────────────────────────────────────────────
//  Local storage for settings + auth token
// ─────────────────────────────────────────────
import type { Settings } from '@/types'

const SETTINGS_KEY = 'medusa_pos_settings'
const TOKEN_KEY = 'medusa_pos_token'

export const defaultSettings: Settings = {
  backendUrl: import.meta.env.VITE_BACKEND_URL || '/medusa',
  publishableKey: import.meta.env.VITE_PUBLISHABLE_KEY || '',
  regionId: null,
  salesChannelId: null,
  language: 'en',
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function loadToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function saveToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

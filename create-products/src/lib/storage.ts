const BACKEND_KEY    = 'medusa_admin_backend'
const TOKEN_KEY      = 'medusa_admin_token'
const MAIN_LANG_KEY  = 'medusa_admin_main_lang'

// Fall back to env vars if nothing saved in localStorage
const ENV_BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ''
const ENV_PUB_KEY = process.env.NEXT_PUBLIC_PUBLISHABLE_KEY || ''

export function getBackendUrl(): string {
  if (typeof window === 'undefined') return ENV_BACKEND
  return localStorage.getItem(BACKEND_KEY) || ENV_BACKEND
}
export function setBackendUrl(url: string) {
  localStorage.setItem(BACKEND_KEY, url)
}

export function getPublishableKey(): string {
  if (typeof window === 'undefined') return ENV_PUB_KEY
  return localStorage.getItem('medusa_admin_pub_key') || ENV_PUB_KEY
}
export function setPublishableKey(key: string) {
  localStorage.setItem('medusa_admin_pub_key', key)
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}
export function isLoggedIn(): boolean { return !!getToken() }

export function getMainLang(): 'en' | 'ar' {
  if (typeof window === 'undefined') return 'ar'
  return (localStorage.getItem(MAIN_LANG_KEY) as 'en' | 'ar') || 'ar'
}
export function setMainLang(lang: 'en' | 'ar') {
  localStorage.setItem(MAIN_LANG_KEY, lang)
}

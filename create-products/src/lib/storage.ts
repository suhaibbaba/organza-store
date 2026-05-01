const BACKEND_KEY   = 'medusa_admin_backend'
const TOKEN_KEY     = 'medusa_admin_token'
const MAIN_LANG_KEY = 'medusa_admin_main_lang'

export function getBackendUrl(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(BACKEND_KEY) || ''
}
export function setBackendUrl(url: string) { localStorage.setItem(BACKEND_KEY, url) }

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
export function setMainLang(lang: 'en' | 'ar') { localStorage.setItem(MAIN_LANG_KEY, lang) }

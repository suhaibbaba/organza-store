import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '@/api/client'
import { LoginScreen } from '@/components/LoginScreen'
import { POSScreen } from '@/components/POSScreen'
import { applyDirection } from '@/i18n'
import { loadSettings, saveSettings } from '@/lib/storage'

export default function App() {
  const { i18n } = useTranslation()
  const [authed, setAuthed] = useState(api.isLoggedIn())

  const toggleLanguage = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar'
    i18n.changeLanguage(next)
    applyDirection(next)
    saveSettings({ ...loadSettings(), language: next })
    // Force remount to flush all RTL layout calculations
    window.location.reload()
  }

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} onLanguageToggle={toggleLanguage} />
  }

  return (
    <POSScreen
      onLogout={() => { api.logout(); setAuthed(false) }}
      onLanguageToggle={toggleLanguage}
    />
  )
}

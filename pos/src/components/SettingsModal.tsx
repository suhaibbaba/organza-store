import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { notifications } from '@/lib/toast'
import { loadSettings, saveSettings } from '@/lib/storage'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface Props {
  opened: boolean
  onClose: () => void
  onSaved: () => void
}

export function SettingsModal({ opened, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [backendUrl, setBackendUrl] = useState('')
  const [publishableKey, setPublishableKey] = useState('')

  useEffect(() => {
    if (opened) {
      const s = loadSettings()
      setBackendUrl(s.backendUrl)
      setPublishableKey(s.publishableKey)
    }
  }, [opened])

  const handleSave = () => {
    const s = loadSettings()
    saveSettings({ ...s, backendUrl: backendUrl.trim(), publishableKey: publishableKey.trim() })
    notifications.show({ message: t('toast.settingsSaved'), color: 'green' })
    onSaved()
    onClose()
  }

  return (
    <Dialog open={opened} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('settings.backendUrl')}</Label>
            <Input
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.currentTarget.value)}
              placeholder="/medusa"
            />
            <p className="text-xs text-muted-foreground">{t('settings.backendUrlHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('settings.publishableKey')}</Label>
            <Input
              type="password"
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.currentTarget.value)}
              placeholder="pk_..."
            />
            <p className="text-xs text-muted-foreground">{t('settings.publishableKeyHint')}</p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('scanner.cancel')}</Button>
          <Button variant="brand" onClick={handleSave}>{t('settings.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { Modal, Stack, TextInput, Button, Text, PasswordInput } from '@mantine/core'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { notifications } from '@mantine/notifications'
import { loadSettings, saveSettings } from '@/lib/storage'

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
    <Modal opened={opened} onClose={onClose} title={t('settings.title')} size="md" centered>
      <Stack>
        <TextInput
          label={t('settings.backendUrl')}
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.currentTarget.value)}
          placeholder="/medusa"
        />
        <Text size="xs" c="dimmed">{t('settings.backendUrlHint')}</Text>

        <PasswordInput
          label={t('settings.publishableKey')}
          value={publishableKey}
          onChange={(e) => setPublishableKey(e.currentTarget.value)}
          placeholder="pk_..."
        />
        <Text size="xs" c="dimmed">{t('settings.publishableKeyHint')}</Text>

        <Button onClick={handleSave} fullWidth>{t('settings.save')}</Button>
      </Stack>
    </Modal>
  )
}

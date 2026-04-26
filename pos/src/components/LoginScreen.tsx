import { useState } from 'react'
import { Paper, Title, Text, TextInput, PasswordInput, Button, Stack, Center, Group, ActionIcon } from '@mantine/core'
import { IconSettings, IconLanguage } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import * as api from '@/api/client'
import { SettingsModal } from './SettingsModal'

interface Props {
  onLogin: () => void
  onLanguageToggle: () => void
}

export function LoginScreen({ onLogin, onLanguageToggle }: Props) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      await api.login(email, password)
      onLogin()
    } catch {
      setErr(t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #228be6 0%, #7048e8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Paper shadow="xl" radius="lg" p="xl" style={{ width: '100%', maxWidth: 420 }}>
        <Group justify="space-between" mb="md">
          <div style={{ width: 36 }} />
          <Center style={{ flex: 1 }}>
            <Title order={2}>🛒 {t('app.title')}</Title>
          </Center>
          <Group gap={4}>
            <ActionIcon variant="subtle" onClick={onLanguageToggle} title={t('app.language')}>
              <IconLanguage size={18} />
            </ActionIcon>
            <ActionIcon variant="subtle" onClick={() => setSettingsOpen(true)} title={t('app.settings')}>
              <IconSettings size={18} />
            </ActionIcon>
          </Group>
        </Group>

        <Text c="dimmed" size="sm" ta="center" mb="lg">{t('login.subtitle')}</Text>

        <form onSubmit={submit}>
          <Stack>
            <TextInput
              type="email"
              label={t('login.email')}
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              autoComplete="email"
            />
            <PasswordInput
              label={t('login.password')}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              autoComplete="current-password"
            />
            {err && <Text c="red" size="sm">{err}</Text>}
            <Button type="submit" loading={loading} size="md" fullWidth>
              {loading ? t('login.signingIn') : t('login.submit')}
            </Button>
          </Stack>
        </form>
      </Paper>

      <SettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => {}} />
    </div>
  )
}

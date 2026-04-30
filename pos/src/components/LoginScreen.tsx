import { useState } from 'react'
import { Paper, Title, Text, TextInput, PasswordInput, Button, Stack, Center, Group, ActionIcon, Box, Divider } from '@mantine/core'
import { IconSettings, IconLanguage, IconShoppingCart, IconAt, IconLock } from '@tabler/icons-react'
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
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1b2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative blobs */}
      <Box style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <Box style={{
        position: 'absolute', bottom: '-5%', left: '-5%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,139,230,0.2) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Box style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Brand mark */}
        <Center mb="xl">
          <Stack align="center" gap="xs">
            <Box
              style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'linear-gradient(135deg, #228be6, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
              }}
            >
              <IconShoppingCart size={32} color="white" />
            </Box>
            <Title order={2} c="white" style={{ letterSpacing: '-0.5px' }}>
              {t('app.title')}
            </Title>
            <Text c="rgba(255,255,255,0.5)" size="sm">{t('login.subtitle')}</Text>
          </Stack>
        </Center>

        <Paper
          shadow="2xl"
          radius="xl"
          p="xl"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {/* Toolbar */}
          <Group justify="flex-end" mb="lg">
            <ActionIcon
              variant="subtle"
              onClick={onLanguageToggle}
              title={t('app.language')}
              radius="md"
            >
              <IconLanguage size={18} />
            </ActionIcon>
            {/*<ActionIcon*/}
            {/*  variant="subtle"*/}
            {/*  onClick={() => setSettingsOpen(true)}*/}
            {/*  title={t('app.settings')}*/}
            {/*  radius="md"*/}
            {/*>*/}
            {/*  <IconSettings size={18} />*/}
            {/*</ActionIcon>*/}
          </Group>

          <Title order={3} mb={4}>Welcome back</Title>
          <Text c="dimmed" size="sm" mb="xl">Sign in to your POS account</Text>

          <form onSubmit={submit}>
            <Stack gap="md">
              <TextInput
                type="email"
                label={t('login.email')}
                placeholder="you@example.com"
                leftSection={<IconAt size={16} />}
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                autoComplete="email"
                radius="md"
                size="md"
              />
              <PasswordInput
                label={t('login.password')}
                placeholder="••••••••"
                leftSection={<IconLock size={16} />}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                autoComplete="current-password"
                radius="md"
                size="md"
              />
              {err && (
                <Box
                  p="sm"
                  style={{
                    background: 'var(--mantine-color-red-0)',
                    border: '1px solid var(--mantine-color-red-3)',
                    borderRadius: 8,
                  }}
                >
                  <Text c="red" size="sm" fw={500}>{err}</Text>
                </Box>
              )}
              <Button
                type="submit"
                loading={loading}
                size="md"
                radius="md"
                fullWidth
                mt={4}
                style={{ fontWeight: 700 }}
              >
                {loading ? t('login.signingIn') : t('login.submit')}
              </Button>
            </Stack>
          </form>
        </Paper>

        <Text c="rgba(255,255,255,0.3)" size="xs" ta="center" mt="lg">
          Powered by Medusa Commerce
        </Text>
      </Box>

      {/* <SettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => {}} /> */}
    </Box>
  )
}

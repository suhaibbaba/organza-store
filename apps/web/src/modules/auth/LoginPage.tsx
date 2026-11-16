import {
  Alert,
  Button,
  Center,
  Checkbox,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import classes from './login.module.css';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { useSession } from './session';

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn, status } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [persistent, setPersistent] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (status === 'signed-in') return <Navigate to={from} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn({ email, password, persistent });
      void navigate(from, { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Center className={`organza-scroll ds-fill ds-pad-md ${classes.page}`}>
      <Paper
        withBorder
        shadow="xl"
        className="ds-w-sm ds-pad-xl"
        component="form"
        onSubmit={submit}
      >
        <Stack>
          <div className={classes.brand} aria-label={t('app.name')}>
            <img src="/brand/mark.png" alt="" width={56} height={56} />
            <span className={classes.wordmark}>ORGANZA</span>
          </div>
          <div>
            <h1 className={classes.title}>{t('login.title')}</h1>
            <p className={classes.subtitle}>{t('login.subtitle')}</p>
          </div>
          {error !== null && <Alert color="red">{errorMessage(error)}</Alert>}
          <TextInput
            label={t('login.email')}
            type="email"
            autoComplete="username"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label={t('login.password')}
            autoComplete="current-password"
            dir="ltr"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Checkbox
            label={t('login.remember')}
            checked={persistent}
            onChange={(e) => setPersistent(e.currentTarget.checked)}
          />
          <Button type="submit" loading={busy} fullWidth>
            {t('login.submit')}
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

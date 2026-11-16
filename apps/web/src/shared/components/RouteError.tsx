import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router';

/** Shown instead of a blank page when a screen crashes; reloading usually recovers. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <Center h="100%" p="xl">
      <Stack align="center" gap="sm" maw={420}>
        <Title order={3}>{t('errors.screenCrashed')}</Title>
        <Text c="dimmed" ta="center">
          {t('errors.screenCrashedHint')}
        </Text>
        <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
      </Stack>
    </Center>
  );
}

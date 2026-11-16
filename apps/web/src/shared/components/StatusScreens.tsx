import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';

export function FullScreenLoader() {
  return (
    <Center h="100%">
      <Loader />
    </Center>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const message = useErrorMessage();
  return (
    <Alert color="red" variant="light">
      <Stack gap="xs">
        <Text size="sm">{message(error)}</Text>
        {onRetry && (
          <Button size="xs" variant="light" color="red" onClick={onRetry} w="fit-content">
            {t('common.retry')}
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

export function EmptyState({ text }: { text?: string }) {
  const { t } = useTranslation();
  return (
    <Center py="xl">
      <Text c="dimmed">{text ?? t('common.empty')}</Text>
    </Center>
  );
}

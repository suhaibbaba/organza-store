import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';

export function FullScreenLoader() {
  return (
    <Center className="ds-fill">
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
          <Button size="xs" variant="light" color="red" onClick={onRetry} className="ds-fit">
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
    <Center className="ds-py-xl">
      <Text className="ds-muted">{text ?? t('common.empty')}</Text>
    </Center>
  );
}

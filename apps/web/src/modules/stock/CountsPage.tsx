import { Badge, Button, Card, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { formatDateTime } from '@web/shared/lib/format';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { useCountMutations, useCounts } from './api';

export const COUNT_COLORS = { OPEN: 'blue', POSTED: 'green', CANCELLED: 'gray' } as const;

export function CountsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const errorMessage = useErrorMessage();
  const query = useCounts();
  const { create } = useCountMutations();
  const [title, setTitle] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title={t('stock.counts')}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setTitle('')}>
            {t('stock.newCount')}
          </Button>
        }
      />
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.length === 0 && <EmptyState />}
      <Stack gap="xs">
        {query.data?.map((c) => (
          <Card
            key={c.id}
            withBorder
            padding="sm"
            onClick={() => navigate(`/stock/counts/${c.id}`)}
            style={{ cursor: 'pointer' }}
          >
            <Group justify="space-between">
              <Stack gap={0}>
                <Text fw={600}>{c.title}</Text>
                <Text size="xs" c="dimmed">
                  <span dir="ltr">{c.number}</span> · {formatDateTime(c.createdAt, i18n.language)}
                </Text>
              </Stack>
              <Badge color={COUNT_COLORS[c.status]} variant="light">
                {t(`stock.countStatus.${c.status}`)}
              </Badge>
            </Group>
          </Card>
        ))}
      </Stack>
      <Modal
        opened={title !== null}
        onClose={() => setTitle(null)}
        title={t('stock.newCount')}
        centered
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title?.trim()) return;
            create.mutate(
              { title: title.trim() },
              {
                onSuccess: (c) => navigate(`/stock/counts/${c.id}`),
                onError: (err) => notifications.show({ color: 'red', message: errorMessage(err) }),
              },
            );
          }}
        >
          <Stack>
            <TextInput
              label={t('stock.countTitle')}
              description={t('stock.countTitleHint')}
              value={title ?? ''}
              onChange={(e) => setTitle(e.currentTarget.value)}
              data-autofocus
            />
            <Group justify="flex-end">
              <Button type="submit" loading={create.isPending}>
                {t('common.save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}

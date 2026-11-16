import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@web/modules/auth/session';
import { PageHeader } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { formatDateTime, toLatinDigits } from '@web/shared/lib/format';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { useCurrencies, useCurrencyMutations } from './api';

/** Prices and the books stay in the default currency; others carry a rate history. */
export function CurrenciesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const errorMessage = useErrorMessage();
  const query = useCurrencies();
  const m = useCurrencyMutations();
  const [dialog, setDialog] = useState<{ code: string; rate: string; isNew: boolean } | null>(null);
  const fail = (e: unknown) => notifications.show({ color: 'red', message: errorMessage(e) });
  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const base = query.data.find((c) => c.isDefault)?.code ?? '';

  const submit = () => {
    if (!dialog) return;
    const done = { onSuccess: () => setDialog(null), onError: fail };
    if (dialog.isNew) m.create.mutate({ code: dialog.code, rate: dialog.rate }, done);
    else m.setRate.mutate({ code: dialog.code, rate: dialog.rate }, done);
  };

  return (
    <>
      <PageHeader
        title={t('currencies.title')}
        actions={
          can('currencies.manage') && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setDialog({ code: '', rate: '', isNew: true })}
            >
              {t('currencies.add')}
            </Button>
          )
        }
      />
      <Card withBorder maw={720}>
        <Table verticalSpacing="sm" fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('currencies.code')}</Table.Th>
              <Table.Th>{t('currencies.rate', { base })}</Table.Th>
              <Table.Th>{t('currencies.setAt')}</Table.Th>
              <Table.Th>{t('staff.status')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {query.data.map((c) => (
              <Table.Tr key={c.code}>
                <Table.Td>
                  <Group gap={6}>
                    <Text fw={600}>{c.code}</Text>
                    {c.isDefault && <Badge size="xs">{t('currencies.default')}</Badge>}
                  </Group>
                </Table.Td>
                <Table.Td dir="ltr">{c.isDefault ? '1' : c.rate}</Table.Td>
                <Table.Td>{c.rateSetAt ? formatDateTime(c.rateSetAt, i18n.language) : ''}</Table.Td>
                <Table.Td>
                  {!c.isDefault && (
                    <Switch
                      size="xs"
                      checked={c.isActive}
                      disabled={!can('currencies.manage')}
                      onChange={(e) =>
                        m.setActive.mutate(
                          { code: c.code, isActive: e.currentTarget.checked },
                          { onError: fail },
                        )
                      }
                    />
                  )}
                </Table.Td>
                <Table.Td>
                  {!c.isDefault && can('currencies.setRate') && (
                    <Button
                      size="compact-xs"
                      variant="light"
                      onClick={() => setDialog({ code: c.code, rate: c.rate, isNew: false })}
                    >
                      {t('currencies.setRate')}
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal
        opened={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog?.isNew ? t('currencies.add') : t('currencies.setRate')}
        centered
      >
        {dialog && (
          <Stack>
            <TextInput
              label={t('currencies.code')}
              dir="ltr"
              maxLength={3}
              disabled={!dialog.isNew}
              value={dialog.code}
              onChange={(e) => setDialog({ ...dialog, code: e.currentTarget.value.toUpperCase() })}
            />
            <TextInput
              label={t('currencies.rate', { base })}
              description={t('currencies.rateHint', { code: dialog.code || '…', base })}
              dir="ltr"
              inputMode="decimal"
              value={dialog.rate}
              onChange={(e) =>
                setDialog({
                  ...dialog,
                  rate: toLatinDigits(e.currentTarget.value).replace(',', '.'),
                })
              }
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDialog(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={submit} loading={m.create.isPending || m.setRate.isPending}>
                {t('common.save')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

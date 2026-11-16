import { BackLink } from '@web/shared/components/PageHeader';
import { Badge, Button, Card, Group, NumberInput, Stack, Table, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { localize } from '@organza/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { type PickedItem, useCount, useCountMutations } from './api';
import { COUNT_COLORS } from './CountsPage';
import { ItemPicker } from './ItemPicker';
import classes from './stock.module.css';

interface Draft {
  item: PickedItem;
  counted: number | string;
}

/** Scan each piece: a repeated scan adds one. Save as you go; posting changes only counted items. */
export function CountDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const query = useCount(id);
  const m = useCountMutations(id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const fail = (e: unknown) => notifications.show({ color: 'red', message: errorMessage(e) });

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const count = query.data;
  const open = count.status === 'OPEN';
  const saved = new Map(count.lines.map((l) => [l.itemId, l]));

  const scanned = (item: PickedItem) =>
    setDrafts((d) => {
      const current = d[item.itemId]?.counted ?? saved.get(item.itemId)?.counted ?? 0;
      return { ...d, [item.itemId]: { item, counted: Number(current) + 1 } };
    });

  const saveDrafts = () => {
    const lines = Object.values(drafts).map((d) => ({
      itemId: d.item.itemId,
      counted: Math.max(0, Number(d.counted) || 0),
    }));
    if (lines.length) m.lines.mutate(lines, { onSuccess: () => setDrafts({}), onError: fail });
  };

  const confirmPost = () =>
    modals.openConfirmModal({
      title: t('stock.postCount'),
      children: <Text size="sm">{t('stock.postCountHint', { count: count.lines.length })}</Text>,
      labels: { confirm: t('stock.postCount'), cancel: t('common.cancel') },
      onConfirm: () => m.post.mutate(undefined, { onError: fail }),
    });

  const pendingRows = Object.values(drafts).filter((d) => !saved.has(d.item.itemId));

  return (
    <>
      <BackLink to="/stock/counts" label={t('stock.counts')} />
      <Group justify="space-between" wrap="wrap" className="ds-mb-lg">
        <Stack gap={2} className="ds-min-0">
          <Group gap="xs">
            <h1 className={classes.detailTitle}>{count.title}</h1>
            <Badge color={COUNT_COLORS[count.status]} variant="light">
              {t(`stock.countStatus.${count.status}`)}
            </Badge>
          </Group>
          <Text size="sm" className="ds-muted ds-ltr">
            {count.number}
          </Text>
        </Stack>
        {open && (
          <Group gap="xs">
            <Button
              variant="default"
              color="red"
              onClick={() => m.cancel.mutate(undefined, { onError: fail })}
              loading={m.cancel.isPending}
            >
              {t('stock.cancelCount')}
            </Button>
            <Button
              onClick={confirmPost}
              disabled={count.lines.length === 0 || Object.keys(drafts).length > 0}
              loading={m.post.isPending}
            >
              {t('stock.postCount')}
            </Button>
          </Group>
        )}
      </Group>
      <Stack gap="md">
        {open && (
          <Card withBorder>
            <Group align="flex-end">
              <div className="ds-grow">
                <ItemPicker onPick={scanned} />
              </div>
              <Button
                onClick={saveDrafts}
                disabled={Object.keys(drafts).length === 0}
                loading={m.lines.isPending}
              >
                {t('stock.saveCounts', { count: Object.keys(drafts).length })}
              </Button>
            </Group>
          </Card>
        )}
        <Card padding={0}>
          <Table.ScrollContainer minWidth={480}>
            <Table verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('catalogue.name')}</Table.Th>
                  <Table.Th className="ds-col-xs">{t('stock.system')}</Table.Th>
                  <Table.Th className="ds-col-sm">{t('stock.counted')}</Table.Th>
                  <Table.Th className="ds-col-xs">{t('stock.difference')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pendingRows.map((d) => (
                  <Table.Tr key={d.item.itemId}>
                    <Table.Td>
                      {[localize(d.item.name, i18n.language), ...d.item.options].join(' · ')}
                    </Table.Td>
                    <Table.Td>{d.item.onHand}</Table.Td>
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        min={0}
                        allowDecimal={false}
                        value={d.counted}
                        onChange={(v) =>
                          setDrafts((s) => ({ ...s, [d.item.itemId]: { ...d, counted: v } }))
                        }
                      />
                    </Table.Td>
                    <Table.Td>{Number(d.counted) - d.item.onHand}</Table.Td>
                  </Table.Tr>
                ))}
                {count.lines.map((l) => {
                  const draft = drafts[l.itemId];
                  const value = draft ? draft.counted : l.counted;
                  const diff = Number(value) - l.system;
                  return (
                    <Table.Tr key={l.itemId}>
                      <Table.Td>
                        {localize(l.name, i18n.language)}{' '}
                        <Text span size="xs" className="ds-muted" dir="ltr">
                          {l.sku}
                        </Text>
                      </Table.Td>
                      <Table.Td>{l.system}</Table.Td>
                      <Table.Td>
                        {open ? (
                          <NumberInput
                            size="xs"
                            min={0}
                            allowDecimal={false}
                            value={value}
                            onChange={(v) =>
                              setDrafts((s) => ({
                                ...s,
                                [l.itemId]: {
                                  item: {
                                    itemId: l.itemId,
                                    productId: '',
                                    sku: l.sku,
                                    name: l.name,
                                    options: [],
                                    onHand: l.system,
                                    damaged: 0,
                                  },
                                  counted: v,
                                },
                              }))
                            }
                          />
                        ) : (
                          l.counted
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text
                          size="sm"
                          className={
                            diff === 0
                              ? undefined
                              : diff > 0
                                ? 'ds-bold ds-success'
                                : 'ds-bold ds-danger'
                          }
                          dir="ltr"
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      </Stack>
    </>
  );
}

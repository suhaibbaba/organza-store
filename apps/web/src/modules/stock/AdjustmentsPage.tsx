import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ADJUSTMENT_REASONS, type AdjustmentReason, localize } from '@organza/shared';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { newIdempotencyKey } from '@web/shared/lib/api-client';
import { formatDateTime } from '@web/shared/lib/format';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import {
  type PickedItem,
  useAdjustment,
  useAdjustments,
  useCreateAdjustment,
  useReverseAdjustment,
} from './api';
import { ItemPicker } from './ItemPicker';

export function AdjustmentsPage() {
  const { t, i18n } = useTranslation();
  const query = useAdjustments();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title={t('stock.adjustments')}
        primary={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            {t('stock.newAdjustment')}
          </Button>
        }
      />
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.length === 0 && <EmptyState />}
      <Stack gap="xs" className="o-list">
        {query.data?.map((a) => (
          <Card
            key={a.id}
            withBorder
            padding="sm"
            onClick={() => setViewing(a.id)}
            style={{ cursor: 'pointer' }}
          >
            <Group justify="space-between">
              <Stack gap={0}>
                <Text fw={600} dir="ltr" ta="start">
                  {a.number}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatDateTime(a.createdAt, i18n.language)}
                  {a.note && ` · ${a.note}`}
                </Text>
              </Stack>
              <Group gap="xs">
                <Badge variant="light">{t(`stock.adjustReason.${a.reason}`)}</Badge>
                {a.reversed && (
                  <Badge color="gray" variant="outline">
                    {t('stock.reversed')}
                  </Badge>
                )}
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
      {creating && <NewAdjustment onClose={() => setCreating(false)} />}
      <AdjustmentDetail id={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

interface Line {
  item: PickedItem;
  value: number | string;
}

function NewAdjustment({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const create = useCreateAdjustment();
  const key = useRef(newIdempotencyKey());
  const [reason, setReason] = useState<AdjustmentReason>('DAMAGE');
  const [mode, setMode] = useState<'delta' | 'counted'>('delta');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const isCorrection = reason === 'COUNT_ADJUSTMENT';
  const counted = isCorrection && mode === 'counted';

  const add = (item: PickedItem) =>
    setLines((ls) =>
      ls.some((l) => l.item.itemId === item.itemId)
        ? ls
        : [...ls, { item, value: counted ? item.onHand : 1 }],
    );

  const submit = () => {
    const out = reason === 'FOUND' ? 1 : isCorrection ? 0 : -1;
    create.mutate(
      {
        idempotencyKey: key.current,
        reason,
        ...(note && { note }),
        lines: lines.map((l) =>
          counted
            ? { itemId: l.item.itemId, counted: Number(l.value) }
            : {
                itemId: l.item.itemId,
                delta: out === 0 ? Number(l.value) : out * Math.abs(Number(l.value)),
              },
        ),
      },
      {
        onSuccess: (doc) => {
          notifications.show({
            color: 'green',
            message: t('stock.adjustmentSaved', { number: doc.number }),
          });
          onClose();
        },
        onError: (e) => notifications.show({ color: 'red', message: errorMessage(e) }),
      },
    );
  };

  return (
    <Modal opened onClose={onClose} title={t('stock.newAdjustment')} size="lg" centered>
      <Stack>
        <Select
          label={t('stock.adjustReasonLabel')}
          data={ADJUSTMENT_REASONS.map((r) => ({ value: r, label: t(`stock.adjustReason.${r}`) }))}
          value={reason}
          onChange={(v) => v && setReason(v as AdjustmentReason)}
          description={t(`stock.adjustReasonHint.${reason}`)}
        />
        {isCorrection && (
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as typeof mode)}
            data={[
              { value: 'delta', label: t('stock.byDifference') },
              { value: 'counted', label: t('stock.byCounted') },
            ]}
          />
        )}
        <ItemPicker onPick={add} />
        {lines.length > 0 && (
          <Table verticalSpacing={4} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('catalogue.name')}</Table.Th>
                <Table.Th w={80}>
                  {reason === 'WRITE_OFF_DAMAGED' ? t('stock.damaged') : t('stock.onHand')}
                </Table.Th>
                <Table.Th w={110}>
                  {counted
                    ? t('stock.counted')
                    : isCorrection
                      ? t('stock.difference')
                      : t('stock.quantity')}
                </Table.Th>
                <Table.Th w={36} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map((l, i) => (
                <Table.Tr key={l.item.itemId}>
                  <Table.Td>
                    {[localize(l.item.name, i18n.language), ...l.item.options].join(' · ')}
                  </Table.Td>
                  <Table.Td>
                    {reason === 'WRITE_OFF_DAMAGED' ? l.item.damaged : l.item.onHand}
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      allowDecimal={false}
                      min={counted ? 0 : isCorrection ? -10000 : 1}
                      max={10000}
                      value={l.value}
                      onChange={(v) =>
                        setLines((ls) => ls.map((x, j) => (j === i ? { ...x, value: v } : x)))
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={t('common.remove')}
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <TextInput
          label={t('common.note')}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={lines.length === 0} loading={create.isPending}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function AdjustmentDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const query = useAdjustment(id);
  const reverse = useReverseAdjustment();
  const [reason, setReason] = useState('');
  const doc = query.data;
  return (
    <Modal opened={Boolean(id)} onClose={onClose} title={doc?.number} size="lg" centered>
      {query.isPending && <FullScreenLoader />}
      {doc && (
        <Stack>
          <Text size="sm">
            {t(`stock.adjustReason.${doc.reason}`)} · {formatDateTime(doc.createdAt, i18n.language)}
            {doc.note && ` · ${doc.note}`}
          </Text>
          <Table verticalSpacing={4} fz="sm">
            <Table.Tbody>
              {doc.lines.map((l) => (
                <Table.Tr key={l.itemId}>
                  <Table.Td>{localize(l.name, i18n.language)}</Table.Td>
                  <Table.Td dir="ltr" style={{ textAlign: 'start' }}>
                    {l.sku}
                  </Table.Td>
                  <Table.Td dir="ltr">
                    {l.previousQuantity} → {l.previousQuantity + l.delta}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {doc.reversed ? (
            <Badge color="gray">{t('stock.reversed')}</Badge>
          ) : (
            <Group align="flex-end">
              <TextInput
                label={t('stock.reverseReason')}
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button
                color="red"
                variant="light"
                disabled={!reason.trim()}
                loading={reverse.isPending}
                onClick={() =>
                  reverse.mutate(
                    { id: doc.id, reason },
                    {
                      onError: (e) =>
                        notifications.show({ color: 'red', message: errorMessage(e) }),
                    },
                  )
                }
              >
                {t('stock.reverse')}
              </Button>
            </Group>
          )}
        </Stack>
      )}
    </Modal>
  );
}

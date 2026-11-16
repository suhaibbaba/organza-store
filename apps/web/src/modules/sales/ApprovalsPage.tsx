import {
  Badge,
  Button,
  Card,
  Group,
  Image,
  Modal,
  Pagination,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  type ApprovalStatus,
  type ApprovalView,
  localize,
  type Translatable,
} from '@organza/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { formatDateTime } from '@web/shared/lib/format';
import { useApprovalActions, useApprovals } from './api';

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDING: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'gray',
};

/**
 * The approvals inbox (proposal C12). Managers see everyone's requests and decide those that
 * are not their own; everyone else follows their own.
 */
export function ApprovalsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [status, setStatus] = useState<'PENDING' | ''>('PENDING');
  const [page, setPage] = useState(1);
  const query = useApprovals({ status: status || undefined, page });
  const pages = query.data ? Math.ceil(query.data.total / query.data.pageSize) : 1;
  return (
    <>
      <PageHeader title={t('nav.approvals')} />
      <Text size="sm" c="dimmed" mb="sm">
        {can('approvals.decide') ? t('approvals.managerHint') : t('approvals.mineHint')}
      </Text>
      <SegmentedControl
        mb="md"
        value={status}
        onChange={(v) => {
          setStatus(v as typeof status);
          setPage(1);
        }}
        data={[
          { value: 'PENDING', label: t('approvals.status.PENDING') },
          { value: '', label: t('sales.all') },
        ]}
      />
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.items.length === 0 && <EmptyState />}
      <Stack gap="sm">
        {query.data?.items.map((a) => (
          <ApprovalCard key={a.id} approval={a} />
        ))}
      </Stack>
      {pages > 1 && (
        <Group justify="center" mt="md">
          <Pagination value={page} onChange={setPage} total={pages} />
        </Group>
      )}
    </>
  );
}

function ApprovalCard({ approval: a }: { approval: ApprovalView }) {
  const { t, i18n } = useTranslation();
  const { user, can } = useSession();
  const errorMessage = useErrorMessage();
  const { approve, cancel } = useApprovalActions();
  const [rejecting, setRejecting] = useState(false);
  const mine = a.requestedBy.id === user?.id;
  const pending = a.status === 'PENDING';

  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      notifications.show({ color: 'green', message: done });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Card withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Text fw={700}>{t(`approvals.kind.${a.kind}`)}</Text>
            <Badge color={STATUS_COLORS[a.status]} variant="light">
              {t(`approvals.status.${a.status}`)}
            </Badge>
          </Group>
          <Summary approval={a} />
          <Text size="sm">{a.reason}</Text>
          <Text size="xs" c="dimmed">
            {a.requestedBy.name} · {formatDateTime(a.requestedAt, i18n.language)}
          </Text>
          {a.decidedAt && (
            <Text size="xs" c="dimmed">
              {a.decidedBy?.name ?? a.requestedBy.name} ·{' '}
              {formatDateTime(a.decidedAt, i18n.language)}
              {a.decisionNote ? ` · ${a.decisionNote}` : ''}
            </Text>
          )}
        </Stack>
        {pending && (
          <Stack gap={6}>
            {can('approvals.decide') && !mine && (
              <>
                <Button
                  size="xs"
                  color="green"
                  loading={approve.isPending}
                  onClick={() =>
                    void run(() => approve.mutateAsync({ id: a.id }), t('approvals.approved'))
                  }
                >
                  {t('approvals.approve')}
                </Button>
                <Button size="xs" variant="light" color="red" onClick={() => setRejecting(true)}>
                  {t('approvals.reject')}
                </Button>
              </>
            )}
            {mine && (
              <Button
                size="xs"
                variant="default"
                loading={cancel.isPending}
                onClick={() => void run(() => cancel.mutateAsync(a.id), t('approvals.cancelled'))}
              >
                {t('approvals.cancel')}
              </Button>
            )}
          </Stack>
        )}
      </Group>
      {rejecting && <RejectDialog id={a.id} onClose={() => setRejecting(false)} />}
    </Card>
  );
}

/** What is being asked, in words; the server resolved names and amounts when it was filed. */
function Summary({ approval: a }: { approval: ApprovalView }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const s = a.summary as Record<string, unknown>;
  const name = (v: unknown) => (v ? localize(v as Translatable, i18n.language) : '');
  switch (a.kind) {
    case 'PRICE_CHANGE':
      return (
        <Text size="sm" component={Link} to={`/products/${String(s['productId'])}`} c="brand.7">
          {name(s['name'])}
          {s['sku'] ? ` (${String(s['sku'])})` : ''}:{' '}
          {s['from'] ? money(String(s['from'])) : t('approvals.productPrice')} →{' '}
          {s['to'] ? money(String(s['to'])) : t('approvals.productPrice')}
        </Text>
      );
    case 'PRODUCT_HIDE':
      return (
        <Text size="sm" component={Link} to={`/products/${String(s['productId'])}`} c="brand.7">
          {name(s['name'])} → {t(`catalogue.status.${String(s['status'])}`)}
        </Text>
      );
    case 'IMAGE_DELETE':
      return (
        <Group gap="xs">
          <Image src={String(s['imageUrl'])} w={56} h={56} radius="sm" alt="" />
          <Text size="sm">{name(s['name'])}</Text>
        </Group>
      );
    case 'STOCK_ADJUSTMENT': {
      const lines = (s['lines'] as { name: unknown; sku: string; delta: number }[]) ?? [];
      return (
        <Stack gap={0}>
          <Text size="sm">{t(`stock.reason.${String(s['reason'])}`)}</Text>
          {lines.map((l, i) => (
            <Text key={i} size="sm">
              {name(l.name)} ({l.sku}): {l.delta > 0 ? `+${l.delta}` : l.delta}
            </Text>
          ))}
        </Stack>
      );
    }
    case 'REFUND':
    case 'VOID':
      return (
        <Text size="sm" component={Link} to={`/sales/${String(s['saleId'])}`} c="brand.7">
          {String(s['saleNumber'])} · {money(String(s['total']))}
          {s['exchange'] ? ` · ${t('returns.kind.EXCHANGE')}` : ''}
        </Text>
      );
  }
}

function RejectDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { reject } = useApprovalActions();
  const [note, setNote] = useState('');
  const submit = async () => {
    try {
      await reject.mutateAsync({ id, note: note.trim() });
      notifications.show({ color: 'green', message: t('approvals.rejected') });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
  return (
    <Modal opened onClose={onClose} title={t('approvals.reject')} centered>
      <Stack>
        <Textarea
          label={t('approvals.rejectNote')}
          required
          data-autofocus
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            color="red"
            loading={reject.isPending}
            disabled={note.trim().length < 3}
            onClick={() => void submit()}
          >
            {t('approvals.reject')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { RegisterView } from '@organza/shared';
import { IconEdit, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { formatDate, formatDateTime } from '@web/shared/lib/format';
import { deviceRegister, useRegisters, useShift, useShiftMutations, useShifts } from './api';
import { SHIFT_COLORS, ShiftPanel } from './ShiftView';

/** "My shift": the open shift on this device's till. */
export function MyShiftPage() {
  const { t } = useTranslation();
  const registers = useRegisters();
  const [registerId, setRegisterId] = useState(() => deviceRegister.get());
  const list = (registers.data ?? []).filter((r) => r.isActive);
  const register =
    list.find((r) => r.id === registerId) ?? (list.length === 1 ? list[0] : undefined);
  const shiftId = register?.openShift?.id ?? register?.countedShiftId;
  const shift = useShift(shiftId);

  if (registers.isPending) return <FullScreenLoader />;
  if (registers.isError)
    return <ErrorState error={registers.error} onRetry={() => void registers.refetch()} />;
  return (
    <>
      <PageHeader
        title={t('nav.shift')}
        actions={
          list.length > 1 && (
            <Select
              w={180}
              value={register?.id ?? null}
              placeholder={t('pos.register')}
              data={list.map((r) => ({ value: r.id, label: r.name }))}
              onChange={(v) => {
                if (!v) return;
                deviceRegister.set(v);
                setRegisterId(v);
              }}
              allowDeselect={false}
            />
          )
        }
      />
      {register && register.pendingCounts > 0 && (
        <Card withBorder mb="md" bg="orange.0">
          <Group justify="space-between">
            <Text size="sm">{t('shifts.pendingCounts', { count: register.pendingCounts })}</Text>
            <Button size="xs" variant="light" component={Link} to="/shifts?attention=1">
              {t('shifts.showThem')}
            </Button>
          </Group>
        </Card>
      )}
      {!shiftId ? (
        <Stack align="center">
          <EmptyState text={t('shifts.noOpenShift')} />
          <Button component={Link} to="/pos">
            {t('pos.openShift')}
          </Button>
        </Stack>
      ) : shift.data ? (
        <ShiftPanel shift={shift.data} />
      ) : shift.isError ? (
        <ErrorState error={shift.error} onRetry={() => void shift.refetch()} />
      ) : (
        <FullScreenLoader />
      )}
    </>
  );
}

export function ShiftDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const shift = useShift(id);
  if (shift.isPending) return <FullScreenLoader />;
  if (shift.isError) return <ErrorState error={shift.error} onRetry={() => void shift.refetch()} />;
  return (
    <>
      <PageHeader title={shift.data.number} back={{ to: '/shifts', label: t('nav.shifts') }} />
      <ShiftPanel shift={shift.data} />
    </>
  );
}

/** Managers: every shift, those needing attention first; registers are managed here too. */
export function ShiftsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const [attention, setAttention] = useState(() =>
    new URLSearchParams(window.location.search).has('attention'),
  );
  const query = useShifts({ attention });
  const [registersOpen, setRegistersOpen] = useState(false);
  return (
    <>
      <PageHeader
        title={t('nav.shifts')}
        actions={
          can('registers.manage') && (
            <Button variant="default" onClick={() => setRegistersOpen(true)}>
              {t('shifts.registers')}
            </Button>
          )
        }
      />
      <Switch
        mb="md"
        label={t('shifts.needsAttention')}
        checked={attention}
        onChange={(e) => setAttention(e.currentTarget.checked)}
      />
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.length === 0 && <EmptyState />}
      <Stack gap="xs" className="o-list">
        {query.data?.map((s) => (
          <Card
            key={s.id}
            withBorder
            padding="sm"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/shifts/${s.id}`)}
          >
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={0}>
                <Group gap={6}>
                  <Text fw={600} dir="ltr">
                    {s.number}
                  </Text>
                  <Text size="sm">{s.register}</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {formatDate(s.businessDate, i18n.language)} · {s.openedBy} ·{' '}
                  {formatDateTime(s.openedAt, i18n.language)}
                </Text>
              </Stack>
              <Group gap={4}>
                {s.hasDifference && (
                  <Badge color="red" variant="light">
                    {t('shifts.difference')}
                  </Badge>
                )}
                {s.signedOff && (
                  <Badge color="teal" variant="light">
                    {t('shifts.signedOff')}
                  </Badge>
                )}
                <Badge color={SHIFT_COLORS[s.status]} variant="light">
                  {t(`shifts.status.${s.status}`)}
                </Badge>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
      <RegistersDialog opened={registersOpen} onClose={() => setRegistersOpen(false)} />
    </>
  );
}

function RegistersDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const registers = useRegisters();
  const { saveRegister } = useShiftMutations();
  const [editing, setEditing] = useState<Partial<RegisterView> | null>(null);
  const save = () => {
    if (!editing?.name?.trim()) return;
    saveRegister.mutate(
      { id: editing.id, name: editing.name.trim(), isActive: editing.isActive },
      {
        onSuccess: () => setEditing(null),
        onError: (e) => notifications.show({ color: 'red', message: errorMessage(e) }),
      },
    );
  };
  return (
    <Modal opened={opened} onClose={onClose} title={t('shifts.registers')} centered>
      <Stack gap="xs">
        {(registers.data ?? []).map((r) => (
          <Group key={r.id} justify="space-between">
            <Group gap={6}>
              <Text c={r.isActive ? undefined : 'dimmed'}>{r.name}</Text>
              {r.openShift && (
                <Badge size="xs" color="green" variant="light">
                  {t('shifts.status.OPEN')}
                </Badge>
              )}
            </Group>
            <ActionIcon
              variant="subtle"
              aria-label={t('common.edit')}
              onClick={() => setEditing(r)}
            >
              <IconEdit size={16} />
            </ActionIcon>
          </Group>
        ))}
        {editing ? (
          <Stack gap="xs" mt="sm">
            <TextInput
              data-autofocus
              label={t('shifts.registerName')}
              value={editing.name ?? ''}
              onChange={(e) => {
                const name = e.currentTarget.value;
                setEditing((x) => ({ ...x, name }));
              }}
            />
            {editing.id && (
              <Switch
                label={t('common.active')}
                checked={editing.isActive ?? true}
                onChange={(e) => {
                  const isActive = e.currentTarget.checked;
                  setEditing((x) => ({ ...x, isActive }));
                }}
              />
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={save} loading={saveRegister.isPending}>
                {t('common.save')}
              </Button>
            </Group>
          </Stack>
        ) : (
          <Button
            mt="sm"
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setEditing({ name: '' })}
          >
            {t('shifts.addRegister')}
          </Button>
        )}
      </Stack>
    </Modal>
  );
}

import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { SupplierView } from '@organza/shared';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { usePurchasingActions, useSuppliers } from './api';
import classes from './purchasing.module.css';

/** Suppliers with what the shop owes each. */
export function SuppliersPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const money = useMoney();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'owed'>('all');
  const [adding, setAdding] = useState(false);
  const query = useSuppliers({ q, owed: filter === 'owed' });
  const totalOwed = (query.data ?? []).reduce((sum, s) => sum + Math.max(0, Number(s.owed)), 0);

  return (
    <>
      <PageHeader
        title={t('nav.suppliers')}
        primary={
          can('suppliers.manage') && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
              {t('suppliers.add')}
            </Button>
          )
        }
      />
      <Group className="ds-mb-md" gap="sm" wrap="wrap">
        <TextInput
          className={classes.search}
          leftSection={<IconSearch size={16} />}
          placeholder={t('suppliers.searchHint')}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          data={[
            { value: 'all', label: t('suppliers.all') },
            { value: 'owed', label: t('suppliers.owedOnly') },
          ]}
        />
        <Text size="sm">
          {t('suppliers.totalOwed')}: <b>{money(totalOwed.toFixed(2))}</b>
        </Text>
      </Group>
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.length === 0 && <EmptyState />}
      {query.data && query.data.length > 0 && (
        <Card padding={0}>
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('suppliers.name')}</Table.Th>
                  <Table.Th>{t('suppliers.contact')}</Table.Th>
                  <Table.Th>{t('customers.phone')}</Table.Th>
                  <Table.Th className="ds-end">{t('suppliers.owed')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.map((s) => {
                  const owed = Number(s.owed);
                  return (
                    <Table.Tr
                      key={s.id}
                      className="ds-clickable"
                      onClick={() => navigate(`/suppliers/${s.id}`)}
                    >
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Anchor
                            component={Link}
                            to={`/suppliers/${s.id}`}
                            className="ds-bold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {s.name}
                          </Anchor>
                          {!s.isActive && (
                            <Badge size="sm" color="gray">
                              {t('common.inactive')}
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" className="ds-muted">
                          {t('suppliers.openCounts', {
                            receipts: s.openReceipts,
                            orders: s.openOrders,
                          })}
                        </Text>
                      </Table.Td>
                      <Table.Td>{s.contactName}</Table.Td>
                      <Table.Td>
                        <span className="ds-ltr">{s.phone}</span>
                      </Table.Td>
                      <Table.Td className="ds-end">
                        {owed > 0 ? (
                          <Badge color="orange" variant="light">
                            {money(owed.toFixed(2))}
                          </Badge>
                        ) : (
                          <Text size="sm" className="ds-muted">
                            {owed < 0 ? `${t('suppliers.paidAhead')} ` : ''}
                            {money(Math.abs(owed).toFixed(2))}
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      {adding && <SupplierForm supplier={null} onClose={() => setAdding(false)} />}
    </>
  );
}

export function SupplierForm({
  supplier,
  onClose,
}: {
  supplier: SupplierView | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { createSupplier, updateSupplier } = usePurchasingActions();
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    note: supplier?.note ?? '',
    isActive: supplier?.isActive ?? true,
  });
  const field = (key: keyof typeof form) => ({
    value: String(form[key]),
    onChange: (e: { currentTarget: { value: string } }) =>
      setForm({ ...form, [key]: e.currentTarget.value }),
  });
  const save = async () => {
    try {
      const body = { ...form, name: form.name.trim() };
      if (supplier) await updateSupplier.mutateAsync({ id: supplier.id, body });
      else await createSupplier.mutateAsync(body);
      notifications.show({ color: 'green', message: t('common.saved') });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
  return (
    <Modal opened onClose={onClose} title={supplier?.name ?? t('suppliers.add')} centered>
      <Stack>
        <TextInput label={t('suppliers.name')} required data-autofocus {...field('name')} />
        <SimpleGrid cols={2}>
          <TextInput label={t('suppliers.contact')} {...field('contactName')} />
          <TextInput label={t('customers.phone')} dir="ltr" {...field('phone')} />
        </SimpleGrid>
        <TextInput label={t('orders.address')} {...field('address')} />
        <Textarea label={t('common.note')} autosize minRows={1} {...field('note')} />
        {supplier && (
          <Switch
            label={t('common.active')}
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            disabled={!form.name.trim()}
            loading={createSupplier.isPending || updateSupplier.isPending}
            onClick={() => void save()}
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

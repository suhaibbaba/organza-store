import { Initials } from '@web/shared/components/Widgets';
import {
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconUserPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useCustomers } from './api';
import { CustomerForm } from './CustomerForm';
import classes from '../catalogue/catalogue.module.css';

export function CustomersPage() {
  const { t } = useTranslation();
  const money = useMoney();
  const navigate = useNavigate();
  const { can } = useSession();
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 250);
  const [withDebt, setWithDebt] = useState(false);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const query = useCustomers({ q: debounced, withDebt, page });
  const pages = query.data ? Math.ceil(query.data.total / query.data.pageSize) : 1;
  return (
    <>
      <PageHeader
        title={t('nav.customers')}
        primary={
          can('customers.edit') && (
            <Button leftSection={<IconUserPlus size={16} />} onClick={() => setAdding(true)}>
              {t('customers.new')}
            </Button>
          )
        }
      />
      <div className={classes.filters}>
        <TextInput
          className={classes.search}
          leftSection={<IconSearch size={16} />}
          placeholder={t('customers.searchHint')}
          value={q}
          onChange={(e) => {
            setQ(e.currentTarget.value);
            setPage(1);
          }}
        />
        <SegmentedControl
          value={withDebt ? 'debt' : 'all'}
          onChange={(v) => {
            setWithDebt(v === 'debt');
            setPage(1);
          }}
          data={[
            { value: 'all', label: t('sales.all') },
            { value: 'debt', label: t('customers.withDebt') },
          ]}
        />
      </div>
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.items.length === 0 && <EmptyState />}
      <Stack gap="xs" className="o-list">
        {query.data?.items.map((c) => (
          <Card
            key={c.id}
            withBorder
            padding="sm"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/customers/${c.id}`)}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Initials name={c.name} />
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text fw={500} truncate>
                    {c.name}
                  </Text>
                  {c.phone && (
                    <Text size="xs" c="dimmed" dir="ltr" ta="start">
                      {c.phone}
                    </Text>
                  )}
                </Stack>
              </Group>
              <Group gap={4}>
                {Number(c.debt) > 0 && (
                  <Badge color="red" variant="light">
                    {t('customers.owes', { amount: money(c.debt) })}
                  </Badge>
                )}
                {Number(c.credit) > 0 && (
                  <Badge color="green" variant="light">
                    {t('customers.hasCredit', { amount: money(c.credit) })}
                  </Badge>
                )}
                {Number(c.deposits) > 0 && (
                  <Badge color="violet" variant="light">
                    {t('customers.deposits', { amount: money(c.deposits) })}
                  </Badge>
                )}
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
      {pages > 1 && (
        <Group justify="center" mt="md">
          <Pagination value={page} onChange={setPage} total={pages} />
        </Group>
      )}
      <CustomerForm
        opened={adding}
        onClose={() => setAdding(false)}
        onSaved={(c) => navigate(`/customers/${c.id}`)}
      />
    </>
  );
}

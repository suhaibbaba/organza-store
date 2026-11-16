import { Initials } from '@web/shared/components/Widgets';
import {
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import type { CustomerView } from '@organza/shared';
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
import c from './pages.module.css';

export function CustomersPage() {
  const { t } = useTranslation();
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
        count={query.data ? query.data.total : undefined}
        primary={
          can('customers.edit') && (
            <Button leftSection={<IconUserPlus size={16} />} onClick={() => setAdding(true)}>
              {t('customers.new')}
            </Button>
          )
        }
      />
      <div className={c.filters}>
        <TextInput
          className={c.search}
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
      {query.data && query.data.items.length > 0 && (
        <>
          <div className={c.wideOnly}>
            <Card withBorder padding={0}>
              <Table.ScrollContainer minWidth={560}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('pos.customer')}</Table.Th>
                      <Table.Th className="ds-col-md">{t('customers.phone')}</Table.Th>
                      <Table.Th className="ds-col-md">{t('customers.city')}</Table.Th>
                      <Table.Th className="ds-col-lg">{t('customers.balance')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {query.data.items.map((cu) => (
                      <Table.Tr
                        key={cu.id}
                        className="ds-clickable"
                        onClick={() => navigate(`/customers/${cu.id}`)}
                      >
                        <Table.Td>
                          <span className={c.person}>
                            <Initials name={cu.name} size="sm" />
                            <span className="ds-medium ds-truncate">{cu.name}</span>
                          </span>
                        </Table.Td>
                        <Table.Td>
                          {cu.phone ? (
                            <span className="ds-muted ds-ltr ds-num">{cu.phone}</span>
                          ) : (
                            <span className="ds-faint">—</span>
                          )}
                        </Table.Td>
                        <Table.Td className="ds-muted">{cu.city ?? '—'}</Table.Td>
                        <Table.Td>
                          <Balances customer={cu} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          </div>
          <div className={c.phoneOnly}>
            <Stack gap="xs" className="o-list">
              {query.data.items.map((cu) => (
                <Card
                  key={cu.id}
                  withBorder
                  padding="sm"
                  className="ds-clickable"
                  onClick={() => navigate(`/customers/${cu.id}`)}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" className="ds-min-0">
                      <Initials name={cu.name} />
                      <Stack gap={0} className="ds-min-0">
                        <Text truncate className="ds-medium">
                          {cu.name}
                        </Text>
                        {cu.phone && (
                          <Text size="xs" className="ds-muted ds-ltr">
                            {cu.phone}
                          </Text>
                        )}
                      </Stack>
                    </Group>
                    <Balances customer={cu} />
                  </Group>
                </Card>
              ))}
            </Stack>
          </div>
        </>
      )}
      {pages > 1 && (
        <div className={c.pager}>
          <Pagination value={page} onChange={setPage} total={pages} />
        </div>
      )}
      <CustomerForm
        opened={adding}
        onClose={() => setAdding(false)}
        onSaved={(c) => navigate(`/customers/${c.id}`)}
      />
    </>
  );
}

/** Debt in red, credit in green, deposits on held goods in violet; nothing when all are zero. */
function Balances({ customer: cu }: { customer: CustomerView }) {
  const { t } = useTranslation();
  const money = useMoney();
  return (
    <Group gap={4}>
      {Number(cu.debt) > 0 && (
        <Badge color="red" variant="light">
          {t('customers.owes', { amount: money(cu.debt) })}
        </Badge>
      )}
      {Number(cu.credit) > 0 && (
        <Badge color="green" variant="light">
          {t('customers.hasCredit', { amount: money(cu.credit) })}
        </Badge>
      )}
      {Number(cu.deposits) > 0 && (
        <Badge color="violet" variant="light">
          {t('customers.deposits', { amount: money(cu.deposits) })}
        </Badge>
      )}
    </Group>
  );
}

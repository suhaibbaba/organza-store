import { Badge, Button, Card, Group, Stack, Table, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@web/modules/auth/session';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { type StaffMember, useStaff } from './api';
import { StaffForm } from './StaffForm';

export function StaffPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const query = useStaff();
  const phone = useMediaQuery('(max-width: 48em)');
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null);
  const manage = can('staff.manage');

  const status = (m: StaffMember) => (
    <Badge color={m.isActive ? 'green' : 'gray'} variant="light">
      {m.isActive ? t('common.active') : t('common.inactive')}
    </Badge>
  );

  return (
    <>
      <PageHeader
        title={t('staff.title')}
        primary={
          manage && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
              {t('staff.new')}
            </Button>
          )
        }
      />
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.length === 0 && <EmptyState />}
      {query.data && query.data.length > 0 && phone && (
        <Stack gap="sm" className="o-list">
          {query.data.map((m) => (
            <Card key={m.id} withBorder onClick={() => manage && setEditing(m)}>
              <Group justify="space-between">
                <div>
                  <Text fw={600}>{m.name}</Text>
                  <Text size="sm" c="dimmed" dir="ltr">
                    {m.email}
                  </Text>
                </div>
                <Stack gap={4} align="flex-end">
                  <Text size="sm">{t(`roles.${m.role}`)}</Text>
                  {status(m)}
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {query.data && query.data.length > 0 && !phone && (
        <Card p={0}>
          <Table.ScrollContainer minWidth={560}>
            <Table highlightOnHover verticalSpacing="sm" fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('staff.name')}</Table.Th>
                  <Table.Th>{t('staff.email')}</Table.Th>
                  <Table.Th>{t('staff.role')}</Table.Th>
                  <Table.Th>{t('staff.status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.map((m) => (
                  <Table.Tr
                    key={m.id}
                    onClick={() => manage && setEditing(m)}
                    style={{ cursor: manage ? 'pointer' : undefined }}
                  >
                    <Table.Td>{m.name}</Table.Td>
                    <Table.Td>
                      <span dir="ltr">{m.email}</span>
                    </Table.Td>
                    <Table.Td>{t(`roles.${m.role}`)}</Table.Td>
                    <Table.Td>{status(m)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      {editing && (
        <StaffForm member={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

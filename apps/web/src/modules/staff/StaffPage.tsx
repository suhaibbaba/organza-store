import { Badge, Button, Card, Group, Stack, Table, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@web/modules/auth/session';
import { PageHeader } from '@web/shared/components/PageHeader';
import { Initials } from '@web/shared/components/Widgets';
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
                <Group gap="sm" wrap="nowrap" className="ds-min-0">
                  <Initials name={m.name} />
                  <div className="ds-min-0">
                    <Text className="ds-bold">{m.name}</Text>
                    <Text size="sm" className="ds-muted ds-ltr">
                      {m.email}
                    </Text>
                  </div>
                </Group>
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
        <Card padding={0}>
          <Table.ScrollContainer minWidth={560}>
            <Table highlightOnHover>
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
                    className={manage ? 'ds-clickable' : undefined}
                  >
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Initials name={m.name} size="sm" />
                        <span className="ds-medium">{m.name}</span>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <span className="ds-ltr">{m.email}</span>
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

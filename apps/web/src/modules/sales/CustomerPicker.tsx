import {
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import type { CustomerView } from '@organza/shared';
import { IconSearch, IconUserPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoney } from '@web/modules/catalogue/components';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { api, ApiError } from '@web/shared/lib/api-client';
import { useCustomerMutations, useCustomers } from './api';

/** Find a customer by name or phone, or add one in two fields. */
export function CustomerPicker({
  opened,
  onClose,
  onPick,
}: {
  opened: boolean;
  onClose: () => void;
  onPick: (customer: CustomerView) => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 250);
  const list = useCustomers({ q: debounced });
  const { create } = useCustomerMutations();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [taken, setTaken] = useState<{ customerId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setQ('');
    setAdding(false);
    setName('');
    setPhone('');
    setTaken(null);
    setError(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const pick = (c: CustomerView) => {
    reset();
    onPick(c);
  };

  const save = async () => {
    setError(null);
    setTaken(null);
    try {
      pick(await create.mutateAsync({ name: name.trim(), phone: phone.trim() || null }));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PHONE_TAKEN')
        setTaken(e.details as { customerId: string; name: string });
      else setError(errorMessage(e));
    }
  };

  return (
    <Modal opened={opened} onClose={close} title={t('customers.pick')} centered size="md">
      {!adding ? (
        <Stack gap="sm">
          <TextInput
            data-autofocus
            leftSection={<IconSearch size={16} />}
            placeholder={t('customers.searchHint')}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
          <ScrollArea.Autosize mah={360}>
            <Stack gap={4}>
              {(list.data?.items ?? []).map((c) => (
                <UnstyledButton
                  key={c.id}
                  onClick={() => pick(c)}
                  p="xs"
                  style={{
                    borderRadius: 8,
                    border: '1px solid var(--mantine-color-default-border)',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text fw={600}>{c.name}</Text>
                      {c.phone && (
                        <Text size="xs" c="dimmed" dir="ltr" ta="start">
                          {c.phone}
                        </Text>
                      )}
                    </div>
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
                    </Group>
                  </Group>
                </UnstyledButton>
              ))}
              {debounced && list.data?.items.length === 0 && (
                <Text c="dimmed" size="sm" ta="center" py="sm">
                  {t('customers.noneFound')}
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
          <Divider />
          <Button
            variant="light"
            leftSection={<IconUserPlus size={16} />}
            onClick={() => {
              setAdding(true);
              if (/\d{3,}/.test(q)) setPhone(q);
              else setName(q);
            }}
          >
            {t('customers.new')}
          </Button>
        </Stack>
      ) : (
        <Stack gap="sm">
          <TextInput
            autoFocus
            label={t('customers.name')}
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label={t('customers.phone')}
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.currentTarget.value)}
          />
          {taken && (
            <Stack gap={4}>
              <Text c="red" size="sm">
                {t('customers.phoneTakenBy', { name: taken.name })}
              </Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => void fetchAndPick(taken.customerId).then((c) => c && pick(c))}
              >
                {t('customers.useExisting')}
              </Button>
            </Stack>
          )}
          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}
          <Group justify="space-between">
            <Button variant="default" onClick={() => setAdding(false)}>
              {t('common.back')}
            </Button>
            <Button onClick={() => void save()} loading={create.isPending} disabled={!name.trim()}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

async function fetchAndPick(id: string): Promise<CustomerView | null> {
  try {
    return await api.get<CustomerView>(`/customers/${id}`);
  } catch {
    return null;
  }
}

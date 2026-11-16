import { Button, Group, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import type { CustomerView } from '@organza/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { ApiError } from '@web/shared/lib/api-client';
import { useCustomerMutations } from './api';

const blank = { name: '', phone: '', whatsapp: '', address: '', city: '', notes: '' };

/** Add or edit a customer. A phone already in use names its owner instead of a bare error. */
export function CustomerForm({
  opened,
  onClose,
  customer,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  customer?: CustomerView;
  onSaved?: (c: CustomerView) => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { create, update } = useCustomerMutations();
  const [form, setForm] = useState(blank);
  const [taken, setTaken] = useState<{ customerId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setTaken(null);
    setError(null);
    setForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone ?? '',
            whatsapp: customer.whatsapp ?? '',
            address: customer.address ?? '',
            city: customer.city ?? '',
            notes: customer.notes ?? '',
          }
        : blank,
    );
  }, [opened, customer]);

  const field = (key: keyof typeof blank) => ({
    value: form[key],
    onChange: (e: { currentTarget: { value: string } }) => {
      const value = e.currentTarget.value;
      setForm((f) => ({ ...f, [key]: value }));
    },
  });

  const save = async () => {
    setTaken(null);
    setError(null);
    const body = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      const saved = customer
        ? await update.mutateAsync({ id: customer.id, body })
        : await create.mutateAsync(body);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PHONE_TAKEN')
        setTaken(e.details as { customerId: string; name: string });
      else setError(errorMessage(e));
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={customer ? t('customers.edit') : t('customers.new')}
      centered
    >
      <Stack gap="sm">
        <TextInput data-autofocus label={t('customers.name')} required {...field('name')} />
        <TextInput label={t('customers.phone')} dir="ltr" inputMode="tel" {...field('phone')} />
        <TextInput
          label={t('customers.whatsapp')}
          dir="ltr"
          inputMode="tel"
          {...field('whatsapp')}
        />
        <TextInput label={t('customers.city')} {...field('city')} />
        <TextInput label={t('customers.address')} {...field('address')} />
        <Textarea label={t('customers.notes')} autosize minRows={2} {...field('notes')} />
        {taken && (
          <Text c="red" size="sm">
            {t('customers.phoneTakenBy', { name: taken.name })}{' '}
            <Link to={`/customers/${taken.customerId}`} onClick={onClose}>
              {t('customers.open')}
            </Link>
          </Text>
        )}
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void save()}
            loading={create.isPending || update.isPending}
            disabled={!form.name.trim()}
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

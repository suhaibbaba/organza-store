import {
  Alert,
  Button,
  Drawer,
  Group,
  PasswordInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { LANGUAGES, ROLES, type Language, type Role } from '@organza/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { type StaffMember, useSaveStaff } from './api';

export function StaffForm({
  member,
  onClose,
}: {
  member: StaffMember | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 48em)');
  const save = useSaveStaff();
  const message = useErrorMessage();
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(member?.phone ?? '');
  const [role, setRole] = useState<Role>(member?.role ?? 'EMPLOYEE');
  const [language, setLanguage] = useState<Language>(member?.language ?? 'ar');
  const [isActive, setIsActive] = useState(member?.isActive ?? true);
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (member) {
      await save.mutateAsync({
        id: member.id,
        update: {
          name,
          phone: phoneNumber || null,
          role,
          language,
          isActive,
          ...(password && { password }),
        },
      });
    } else {
      await save.mutateAsync({
        create: {
          name,
          email,
          role,
          language,
          password,
          ...(phoneNumber && { phone: phoneNumber }),
        },
      });
    }
    onClose();
  }

  return (
    <Drawer
      opened
      onClose={onClose}
      title={member ? t('staff.edit') : t('staff.new')}
      position={phone ? 'bottom' : 'right'}
      size={phone ? '90%' : 'md'}
    >
      <form onSubmit={(e) => void submit(e).catch(() => undefined)}>
        <Stack>
          {save.isError && <Alert color="red">{message(save.error)}</Alert>}
          <TextInput
            label={t('staff.name')}
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label={t('staff.email')}
            type="email"
            dir="ltr"
            required
            disabled={Boolean(member)}
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <TextInput
            label={t('staff.phone')}
            type="tel"
            dir="ltr"
            inputMode="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.currentTarget.value)}
          />
          <Select
            label={t('staff.role')}
            data={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
            value={role}
            onChange={(v) => v && setRole(v as Role)}
            allowDeselect={false}
          />
          <Select
            label={t('staff.language')}
            data={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))}
            value={language}
            onChange={(v) => v && setLanguage(v as Language)}
            allowDeselect={false}
          />
          <PasswordInput
            label={member ? t('staff.newPassword') : t('staff.password')}
            dir="ltr"
            required={!member}
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          {member && (
            <Switch
              label={t('common.active')}
              checked={isActive}
              onChange={(e) => setIsActive(e.currentTarget.checked)}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}

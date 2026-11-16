import {
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ShopSettings } from '@organza/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@web/modules/auth/session';
import { MoneyInput } from '@web/shared/components/MoneyInput';
import { PageHeader } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { TranslatableInput } from '@web/shared/components/TranslatableInput';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { useSaveSettings, useSettings } from './api';

/** One document with defaults; only an Admin can change it. */
export function SettingsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const errorMessage = useErrorMessage();
  const query = useSettings();
  const save = useSaveSettings();
  const [s, setS] = useState<ShopSettings | null>(null);
  useEffect(() => {
    if (query.data) setS(query.data);
  }, [query.data]);
  if (query.isPending || !s) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const readOnly = !can('settings.manage');
  const set = <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) =>
    setS({ ...s, [key]: value });
  const label = <K extends keyof ShopSettings['label']>(key: K, value: ShopSettings['label'][K]) =>
    set('label', { ...s.label, [key]: value });
  const num = (v: number | string) => (typeof v === 'number' ? v : Number(v) || 0);

  return (
    <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
      <PageHeader
        title={t('settings.title')}
        actions={
          !readOnly && (
            <Button
              loading={save.isPending}
              onClick={() =>
                save.mutate(s, {
                  onSuccess: () =>
                    notifications.show({ color: 'green', message: t('common.saved') }),
                  onError: (e) => notifications.show({ color: 'red', message: errorMessage(e) }),
                })
              }
            >
              {t('common.save')}
            </Button>
          )
        }
      />
      <Stack gap="md" maw={860}>
        <Card withBorder>
          <Title order={4} size="h5" mb="sm">
            {t('settings.shop')}
          </Title>
          <Stack gap="sm">
            <TranslatableInput
              label={t('settings.storeName')}
              value={s.storeName}
              onChange={(v) => set('storeName', v)}
            />
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <TextInput
                label={t('settings.phone')}
                dir="ltr"
                value={s.phone}
                onChange={(e) => set('phone', e.currentTarget.value)}
              />
              <TextInput
                label={t('settings.countryCode')}
                dir="ltr"
                value={s.defaultCountryCode}
                onChange={(e) => set('defaultCountryCode', e.currentTarget.value)}
              />
            </SimpleGrid>
            <TranslatableInput
              label={t('settings.address')}
              value={s.address}
              onChange={(v) => set('address', v)}
            />
            <TranslatableInput
              label={t('settings.receiptFooter')}
              value={s.receiptFooter}
              onChange={(v) => set('receiptFooter', v)}
              multiline
            />
          </Stack>
        </Card>
        <Card withBorder>
          <Title order={4} size="h5" mb="sm">
            {t('settings.rules')}
          </Title>
          <SimpleGrid cols={{ base: 1, xs: 2 }}>
            <NumberInput
              label={t('settings.lowStock')}
              min={0}
              allowDecimal={false}
              value={s.lowStockThreshold}
              onChange={(v) => set('lowStockThreshold', num(v))}
            />
            <NumberInput
              label={t('settings.maxDiscount')}
              min={0}
              max={100}
              suffix="%"
              value={s.employeeMaxDiscountPercent}
              onChange={(v) => set('employeeMaxDiscountPercent', num(v))}
            />
            <MoneyInput
              label={t('settings.refundLimit')}
              value={s.employeeRefundLimit}
              onChange={(v) => set('employeeRefundLimit', v)}
            />
            <MoneyInput
              label={t('settings.expenseLimit')}
              value={s.expenseApprovalLimit}
              onChange={(v) => set('expenseApprovalLimit', v)}
            />
            <NumberInput
              label={t('settings.heldDays')}
              min={1}
              max={365}
              allowDecimal={false}
              value={s.heldReminderDays}
              onChange={(v) => set('heldReminderDays', num(v))}
            />
            <NumberInput
              label={t('settings.backdateDays')}
              min={0}
              max={60}
              allowDecimal={false}
              value={s.backdateDays}
              onChange={(v) => set('backdateDays', num(v))}
            />
          </SimpleGrid>
        </Card>
        <Card withBorder>
          <Title order={4} size="h5" mb="sm">
            {t('settings.labels')}
          </Title>
          <Stack gap="sm">
            <SegmentedControl
              value={s.label.mode}
              onChange={(v) => label('mode', v as ShopSettings['label']['mode'])}
              data={[
                { value: 'THERMAL', label: t('settings.thermal') },
                { value: 'A4_GRID', label: t('settings.a4') },
              ]}
            />
            <SimpleGrid cols={{ base: 2, xs: 4 }}>
              <NumberInput
                label={t('settings.widthMm')}
                min={10}
                max={210}
                value={s.label.widthMm}
                onChange={(v) => label('widthMm', num(v))}
              />
              <NumberInput
                label={t('settings.heightMm')}
                min={10}
                max={297}
                value={s.label.heightMm}
                onChange={(v) => label('heightMm', num(v))}
              />
              {s.label.mode === 'A4_GRID' && (
                <>
                  <NumberInput
                    label={t('settings.columns')}
                    min={1}
                    max={10}
                    allowDecimal={false}
                    value={s.label.columns}
                    onChange={(v) => label('columns', num(v))}
                  />
                  <NumberInput
                    label={t('settings.rows')}
                    min={1}
                    max={20}
                    allowDecimal={false}
                    value={s.label.rows}
                    onChange={(v) => label('rows', num(v))}
                  />
                  <NumberInput
                    label={t('settings.marginTop')}
                    min={0}
                    value={s.label.marginTopMm}
                    onChange={(v) => label('marginTopMm', num(v))}
                  />
                  <NumberInput
                    label={t('settings.marginSide')}
                    min={0}
                    value={s.label.marginLeftMm}
                    onChange={(v) =>
                      setS({
                        ...s,
                        label: { ...s.label, marginLeftMm: num(v), marginRightMm: num(v) },
                      })
                    }
                  />
                  <NumberInput
                    label={t('settings.gapX')}
                    min={0}
                    value={s.label.gapXMm}
                    onChange={(v) => label('gapXMm', num(v))}
                  />
                  <NumberInput
                    label={t('settings.gapY')}
                    min={0}
                    value={s.label.gapYMm}
                    onChange={(v) => label('gapYMm', num(v))}
                  />
                </>
              )}
            </SimpleGrid>
          </Stack>
        </Card>
        <Card withBorder>
          <Title order={4} size="h5" mb="sm">
            {t('settings.saleNotifications')}
          </Title>
          <Group align="flex-end">
            <Switch
              label={t('settings.notifyEnabled')}
              checked={s.saleNotifications.enabled}
              onChange={(e) =>
                set('saleNotifications', {
                  ...s.saleNotifications,
                  enabled: e.currentTarget.checked,
                })
              }
            />
            <SegmentedControl
              size="xs"
              value={s.saleNotifications.mode}
              onChange={(v) =>
                set('saleNotifications', {
                  ...s.saleNotifications,
                  mode: v as ShopSettings['saleNotifications']['mode'],
                })
              }
              data={[
                { value: 'EVERY_SALE', label: t('settings.everySale') },
                { value: 'ABOVE_AMOUNT', label: t('settings.aboveAmount') },
              ]}
            />
            {s.saleNotifications.mode === 'ABOVE_AMOUNT' && (
              <MoneyInput
                w={140}
                value={s.saleNotifications.minAmount}
                onChange={(v) => set('saleNotifications', { ...s.saleNotifications, minAmount: v })}
              />
            )}
          </Group>
        </Card>
      </Stack>
    </fieldset>
  );
}

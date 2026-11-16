import {
  Alert,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCash, IconDownload, IconPrinter, IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isRtl, type ReceiptBlock } from '@web/modules/sales/receipt-blocks';
import { paintReceipt } from '@web/modules/sales/receipt-paint';
import { PageHeader } from '@web/shared/components/PageHeader';
import { formatDateTime } from '@web/shared/lib/format';
import { desktop, isDesktop, type UpdateInfo } from '@web/shared/platform/desktop';
import {
  type DevicePrintSettings,
  printSettings,
  receiptPrinter,
} from '@web/shared/printing/printer';

/**
 * This device (phase 7): which receipt printer this PC uses, whether receipts print by
 * themselves, the cash drawer, and app updates. Settings live on the device, not the shop.
 */
export function DevicePage() {
  const { t } = useTranslation();
  if (!isDesktop())
    return (
      <>
        <PageHeader title={t('nav.device')} />
        <Alert color="blue">{t('device.browserOnly')}</Alert>
      </>
    );
  return (
    <>
      <PageHeader title={t('nav.device')} />
      <Stack maw={560}>
        <PrinterCard />
        <UpdateCard />
      </Stack>
    </>
  );
}

function PrinterCard() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<DevicePrintSettings>(() => printSettings.get());
  const [busy, setBusy] = useState(false);
  const printers = useQuery({
    queryKey: ['device', 'printers'],
    queryFn: () => receiptPrinter.get().listPrinters(),
  });
  const update = (patch: Partial<DevicePrintSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    printSettings.set(next);
  };
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      notifications.show({ color: 'green', message: t('device.sent') });
    } catch (e) {
      notifications.show({
        color: 'red',
        message: t('device.printFailed', { reason: e instanceof Error ? e.message : String(e) }),
      });
    } finally {
      setBusy(false);
    }
  };
  const testPage = async () => {
    const lang = i18n.language;
    const blocks: ReceiptBlock[] = [
      { kind: 'title', text: 'Organza' },
      { kind: 'center', text: t('device.testLine') },
      { kind: 'meta', start: settings.printer ?? '', end: formatDateTime(new Date(), lang) },
      { kind: 'rule' },
      {
        kind: 'line',
        name: t('device.sampleItem'),
        amount: '₪350.00',
        details: [t('device.sampleVariant')],
      },
      { kind: 'row', label: t('sales.total'), value: '₪350.00', strong: true },
      { kind: 'footer', text: t('device.sampleFooter') },
    ];
    const image = await paintReceipt(blocks, { rtl: isRtl(lang), paper: settings.paper });
    await receiptPrinter.get().printImage(image, { openDrawer: false });
  };
  const options = [
    ...(printers.data ?? []).map((p) => ({ value: p, label: p })),
    ...(settings.printer && !printers.data?.includes(settings.printer)
      ? [{ value: settings.printer, label: settings.printer }]
      : []),
  ];

  return (
    <Card withBorder>
      <Text fw={600} mb="sm">
        {t('device.receiptPrinter')}
      </Text>
      <Stack gap="sm">
        <Select
          label={t('device.printer')}
          placeholder={t('device.choosePrinter')}
          data={options}
          value={settings.printer}
          onChange={(v) => update({ printer: v })}
          searchable
          nothingFoundMessage={t('device.noPrinters')}
          rightSection={printers.isFetching ? undefined : null}
        />
        <TextInput
          label={t('device.networkPrinter')}
          description={t('device.networkHint')}
          placeholder="tcp://192.168.1.50:9100"
          dir="ltr"
          defaultValue={settings.printer?.startsWith('tcp://') ? settings.printer : ''}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v) update({ printer: v });
          }}
        />
        <Group gap="md">
          <Text size="sm">{t('device.paper')}</Text>
          <SegmentedControl
            size="xs"
            value={String(settings.paper)}
            onChange={(v) => update({ paper: Number(v) as 80 | 58 })}
            data={[
              { value: '80', label: '80 mm' },
              { value: '58', label: '58 mm' },
            ]}
          />
        </Group>
        <Switch
          label={t('device.autoPrint')}
          checked={settings.autoPrint}
          onChange={(e) => update({ autoPrint: e.currentTarget.checked })}
        />
        <Switch
          label={t('device.drawerOnCash')}
          checked={settings.drawerOnCash}
          onChange={(e) => update({ drawerOnCash: e.currentTarget.checked })}
        />
        <Group gap="md">
          <Text size="sm">{t('device.drawerPin')}</Text>
          <SegmentedControl
            size="xs"
            value={String(settings.drawerPin)}
            onChange={(v) => update({ drawerPin: Number(v) as 0 | 1 })}
            data={[
              { value: '0', label: t('device.pin2') },
              { value: '1', label: t('device.pin5') },
            ]}
          />
        </Group>
        <Group>
          <Button
            leftSection={<IconPrinter size={16} />}
            disabled={!settings.printer}
            loading={busy}
            onClick={() => void run(testPage)}
          >
            {t('device.testPrint')}
          </Button>
          <Button
            variant="default"
            leftSection={<IconCash size={16} />}
            disabled={!settings.printer}
            loading={busy}
            onClick={() => void run(() => receiptPrinter.get().openDrawer())}
          >
            {t('device.openDrawer')}
          </Button>
          <Button
            variant="subtle"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void printers.refetch()}
          >
            {t('device.refreshPrinters')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function UpdateCard() {
  const { t } = useTranslation();
  const info = useQuery({ queryKey: ['device', 'info'], queryFn: desktop.info });
  const [update, setUpdate] = useState<UpdateInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    try {
      setUpdate(await desktop.checkForUpdate());
    } catch (e) {
      notifications.show({ color: 'red', message: String(e) });
    } finally {
      setBusy(false);
    }
  };
  const install = async () => {
    setBusy(true);
    try {
      await desktop.installUpdate();
    } catch (e) {
      notifications.show({ color: 'red', message: String(e) });
      setBusy(false);
    }
  };
  return (
    <Card withBorder>
      <Text fw={600} mb="xs">
        {t('device.app')}
      </Text>
      <Text size="sm" c="dimmed" mb="sm">
        {t('device.version', { version: info.data?.version ?? '…', os: info.data?.os ?? '' })}
      </Text>
      {update === null && (
        <Alert color="green" mb="sm">
          {t('device.upToDate')}
        </Alert>
      )}
      {update && (
        <Alert color="blue" mb="sm">
          {t('device.updateAvailable', { version: update.version })}
          {update.notes && <Text size="sm">{update.notes}</Text>}
        </Alert>
      )}
      <Group>
        <Button variant="default" loading={busy} onClick={() => void check()}>
          {t('device.checkUpdate')}
        </Button>
        {update && (
          <Button
            leftSection={<IconDownload size={16} />}
            loading={busy}
            onClick={() => void install()}
          >
            {t('device.installUpdate')}
          </Button>
        )}
      </Group>
    </Card>
  );
}

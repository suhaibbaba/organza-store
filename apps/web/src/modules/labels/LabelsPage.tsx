import {
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { type LabelData, labelSettingsSchema, localize } from '@organza/shared';
import { IconPrinter } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { fetchLabels, markLabelsPrinted, useProducts } from '@web/modules/catalogue/api';
import { useLocalized, useMoney } from '@web/modules/catalogue/components';
import { useSettings } from '@web/modules/settings/api';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { type LabelCopy, LabelSheets } from './LabelSheets';
import classes from './labels.module.css';

const MAX_COPIES = 500;

/** Pick products (default: those whose labels were never printed), set copies, print. */
export function LabelsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const localized = useLocalized();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const client = useQueryClient();
  const settings = useSettings();
  const layout = settings.data?.label ?? labelSettingsSchema.parse({});
  const pending = useProducts({ labelsPending: true, status: 'ACTIVE', pageSize: 100, page: 1 });
  const selected = useMemo(
    () => (params.get('products') ?? '').split(',').filter(Boolean),
    [params],
  );
  const labels = useQuery({
    queryKey: ['labels', selected],
    queryFn: () => fetchLabels({ productIds: selected }),
    enabled: selected.length > 0,
  });
  const [copies, setCopies] = useState<Record<string, number | string>>({});
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    setCopies(
      Object.fromEntries((labels.data ?? []).map((l) => [l.itemId, Math.max(1, l.onHand)])),
    );
    setPrinted(false);
  }, [labels.data]);

  const runs: LabelCopy[] = useMemo(() => {
    const out: LabelCopy[] = [];
    for (const label of labels.data ?? []) {
      const n = Math.min(MAX_COPIES, Number(copies[label.itemId]) || 0);
      for (let i = 0; i < n; i++) out.push({ label, key: `${label.itemId}-${i}` });
    }
    return out.slice(0, MAX_COPIES);
  }, [labels.data, copies]);

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((s) => s !== id);
    setParams(next.length ? { products: next.join(',') } : {}, { replace: true });
  };

  const print = () => {
    const style = document.createElement('style');
    style.textContent =
      layout.mode === 'THERMAL'
        ? `@page { size: ${layout.widthMm}mm ${layout.heightMm}mm; margin: 0; }`
        : '@page { size: A4; margin: 0; }';
    document.head.appendChild(style);
    document.body.classList.add('printing-labels');
    const cleanup = () => {
      document.body.classList.remove('printing-labels');
      style.remove();
      window.removeEventListener('afterprint', cleanup);
      setPrinted(true);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const confirmPrinted = async () => {
    try {
      await markLabelsPrinted(selected);
      await client.invalidateQueries({ queryKey: ['products'] });
      notifications.show({ color: 'green', message: t('labels.marked') });
      setParams({}, { replace: true });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  const rowName = (l: LabelData) =>
    [localize(l.name, i18n.language), ...l.options.map((o) => localize(o, i18n.language))].join(
      ' · ',
    );

  return (
    <>
      <PageHeader
        title={t('labels.title')}
        actions={
          <Button
            leftSection={<IconPrinter size={16} />}
            disabled={runs.length === 0}
            onClick={print}
          >
            {t('labels.printCount', { count: runs.length })}
          </Button>
        }
      />
      <Stack gap="md">
        {printed && (
          <Alert color="green" title={t('labels.didItPrint')}>
            <Group>
              <Button size="xs" onClick={() => void confirmPrinted()}>
                {t('labels.markPrinted')}
              </Button>
              <Button size="xs" variant="default" onClick={() => setPrinted(false)}>
                {t('labels.notYet')}
              </Button>
            </Group>
          </Alert>
        )}
        <Card withBorder>
          <Text fw={600} mb="xs">
            {t('labels.pending')}
          </Text>
          {pending.isPending && <FullScreenLoader />}
          {pending.data?.items.length === 0 && selected.length === 0 && <EmptyState />}
          <Stack gap={4}>
            {pending.data?.items.map((p) => (
              <Checkbox
                key={p.id}
                label={`#${p.number} ${localized(p.name)}`}
                checked={selected.includes(p.id)}
                onChange={(e) => toggle(p.id, e.currentTarget.checked)}
              />
            ))}
            {selected
              .filter((id) => !pending.data?.items.some((p) => p.id === id))
              .map((id) => {
                const any = labels.data?.find((l) => l.productId === id);
                return (
                  <Checkbox
                    key={id}
                    label={any ? localize(any.name, i18n.language) : id}
                    checked
                    onChange={() => toggle(id, false)}
                  />
                );
              })}
          </Stack>
        </Card>
        {(labels.data?.length ?? 0) > 0 && (
          <Card p={0}>
            <Table verticalSpacing={4} fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('catalogue.name')}</Table.Th>
                  <Table.Th>{t('catalogue.barcode')}</Table.Th>
                  <Table.Th w={110}>{t('labels.copies')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {labels.data?.map((l) => (
                  <Table.Tr key={l.itemId}>
                    <Table.Td>{rowName(l)}</Table.Td>
                    <Table.Td dir="ltr" style={{ textAlign: 'start' }}>
                      {l.barcode}
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        min={0}
                        max={MAX_COPIES}
                        allowDecimal={false}
                        value={copies[l.itemId] ?? 1}
                        onChange={(v) => setCopies((c) => ({ ...c, [l.itemId]: v }))}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}
        {runs.length > 0 && (
          <div className={classes.preview}>
            <LabelSheets
              copies={runs.slice(0, layout.mode === 'THERMAL' ? 6 : layout.columns * layout.rows)}
              layout={layout}
              language={i18n.language}
              money={money}
            />
            <Text size="xs" c="dimmed" ta="center">
              {t('labels.previewNote')}
            </Text>
          </div>
        )}
      </Stack>
      {createPortal(
        <div className="label-print-root">
          <LabelSheets copies={runs} layout={layout} language={i18n.language} money={money} />
        </div>,
        document.body,
      )}
    </>
  );
}

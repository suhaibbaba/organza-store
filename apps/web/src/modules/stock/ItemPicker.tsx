import { Autocomplete, Button, Modal, Stack, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { localize, type ProductView } from '@organza/shared';
import { IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBarcodeScanner } from '@web/shared/hooks/use-barcode-scanner';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { type PickedItem, resolveScan, useStock } from './api';

/** Find an item by name, SKU or a scan; a shared code asks which variant. */
export function ItemPicker({
  onPick,
  disabled,
}: {
  onPick: (item: PickedItem) => void;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 250);
  const [choices, setChoices] = useState<PickedItem[] | null>(null);
  const results = useStock({ q: debounced, pageSize: 20, page: 1 });
  const rows = debounced.length >= 2 ? (results.data?.items ?? []) : [];
  const text = (name: PickedItem['name'], options: string[], sku: string) =>
    [localize(name, i18n.language), ...options].join(' · ') + ` (${sku})`;

  const optionLabel = (p: ProductView, itemId: string) => {
    const item = p.items.find((i) => i.id === itemId);
    if (!item) return [];
    return p.type === 'NUMBERED'
      ? [`#${item.number}`]
      : item.options.map((o) => localize(o.value, i18n.language));
  };

  const scan = (code: string) => {
    resolveScan(code, optionLabel).then(
      (items) => {
        if (items.length === 1) onPick(items[0]!);
        else if (items.length > 1) setChoices(items);
      },
      (e: unknown) => notifications.show({ color: 'red', message: errorMessage(e) }),
    );
  };
  useBarcodeScanner(scan, !disabled);

  return (
    <>
      <Autocomplete
        leftSection={<IconSearch size={16} />}
        placeholder={t('stock.findItem')}
        value={q}
        onChange={setQ}
        disabled={disabled}
        data={rows.map((r) => ({ value: r.itemId, label: text(r.name, r.options, r.sku) }))}
        filter={({ options }) => options}
        onOptionSubmit={(itemId) => {
          const r = rows.find((x) => x.itemId === itemId);
          if (r)
            onPick({
              itemId: r.itemId,
              productId: r.productId,
              sku: r.sku,
              name: r.name,
              options: r.options,
              onHand: r.onHand,
              damaged: r.damaged,
            });
          setQ('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim().length >= 4 && rows.length === 0) {
            e.preventDefault();
            scan(q.trim());
            setQ('');
          }
        }}
      />
      <Modal
        opened={Boolean(choices)}
        onClose={() => setChoices(null)}
        title={t('stock.whichOne')}
        centered
      >
        <Stack gap="xs">
          {choices?.map((c) => (
            <Button
              key={c.itemId}
              variant="default"
              justify="space-between"
              onClick={() => {
                onPick(c);
                setChoices(null);
              }}
              rightSection={<Text size="xs">{t('stock.onHandShort', { count: c.onHand })}</Text>}
            >
              {c.options.join(' · ') || c.sku}
            </Button>
          ))}
        </Stack>
      </Modal>
    </>
  );
}

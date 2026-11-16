import {
  ActionIcon,
  Button,
  Drawer,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { localize, type Translatable } from '@organza/shared';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoney } from '@web/modules/catalogue/components';
import { useItemChooser } from '@web/modules/pos/picking';
import { ProductBrowser } from '@web/modules/pos/ProductBrowser';
import { useBarcodeScanner } from '@web/shared/hooks/use-barcode-scanner';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { toLatinDigits } from '@web/shared/lib/format';

export interface CostLine {
  key: string;
  itemId: string;
  name: Translatable;
  variantLabel: string | Translatable | null;
  sku: string;
  quantity: number;
  unitCost: string;
  /** Ordered and not yet delivered, when receiving against a purchase order. */
  open?: number;
}

const label = (v: string | Translatable | null, lang: string) =>
  v === null ? '' : typeof v === 'string' ? v : localize(v, lang);

export const isCost = (v: string) => /^\d{1,8}(\.\d{1,4})?$/.test(v);
export const lineValue = (l: CostLine) =>
  isCost(l.unitCost) ? Math.round(l.quantity * Number(l.unitCost) * 100) / 100 : 0;

/** Lines with a quantity and a unit cost; items added from the browser or the scanner. */
export function PurchaseLinesEditor({
  lines,
  onChange,
}: {
  lines: CostLine[];
  onChange: (lines: CostLine[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const [browsing, setBrowsing] = useState(false);
  const chooser = useItemChooser((p) => {
    const existing = lines.find((l) => l.itemId === p.itemId);
    if (existing)
      onChange(lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l)));
    else
      onChange([
        ...lines,
        {
          key: `${p.itemId}-${Date.now()}`,
          itemId: p.itemId,
          name: p.name,
          variantLabel: p.variantLabel,
          sku: p.sku,
          quantity: 1,
          unitCost: '',
        },
      ]);
    setBrowsing(false);
  }, true);
  const onCode = useCallback(
    async (code: string) => {
      try {
        const found = await chooser.pickCode(code);
        if (!found)
          notifications.show({ color: 'orange', message: t('pos.codeNotFound', { code }) });
        return found;
      } catch (e) {
        notifications.show({ color: 'red', message: errorMessage(e) });
        return false;
      }
    },
    [chooser, errorMessage, t],
  );
  useBarcodeScanner((code) => void onCode(code), !browsing);

  const set = (key: string, patch: Partial<CostLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <Stack gap="xs">
      {lines.length === 0 && (
        <Text c="dimmed" size="sm">
          {t('purchasing.scanHint')}
        </Text>
      )}
      {lines.map((l) => (
        <Group key={l.key} wrap="wrap" gap="sm" align="flex-end">
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <Text size="sm" fw={600} truncate>
              {localize(l.name, i18n.language)}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {[label(l.variantLabel, i18n.language), l.sku].filter(Boolean).join(' · ')}
              {l.open !== undefined ? ` · ${t('purchasing.stillOpen', { count: l.open })}` : ''}
            </Text>
          </div>
          <NumberInput
            w={84}
            size="xs"
            label={t('sales.quantity')}
            min={1}
            max={10000}
            allowDecimal={false}
            value={l.quantity}
            onChange={(v) => set(l.key, { quantity: Math.max(1, Number(v) || 1) })}
          />
          <TextInput
            w={100}
            size="xs"
            dir="ltr"
            inputMode="decimal"
            label={t('purchasing.unitCost')}
            error={l.unitCost !== '' && !isCost(l.unitCost)}
            value={l.unitCost}
            onChange={(e) =>
              set(l.key, {
                unitCost: toLatinDigits(e.currentTarget.value)
                  .replace(',', '.')
                  .replace(/[^\d.]/g, ''),
              })
            }
          />
          <Text size="sm" fw={600} w={80} ta="end" pb={6}>
            {money(lineValue(l).toFixed(2))}
          </Text>
          <ActionIcon
            variant="subtle"
            color="red"
            mb={4}
            aria-label={t('common.remove')}
            onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      ))}
      <Group>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => setBrowsing(true)}
        >
          {t('returns.addItems')}
        </Button>
      </Group>
      {chooser.picker}
      <Drawer
        opened={browsing}
        onClose={() => setBrowsing(false)}
        position="bottom"
        size="90%"
        title={t('returns.addItems')}
      >
        <Stack gap="sm" h="70vh">
          {browsing && (
            <ProductBrowser
              onProduct={(id) =>
                void chooser
                  .pickProduct(id)
                  .catch((e: unknown) =>
                    notifications.show({ color: 'red', message: errorMessage(e) }),
                  )
              }
              onCode={onCode}
              anyStock
            />
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}

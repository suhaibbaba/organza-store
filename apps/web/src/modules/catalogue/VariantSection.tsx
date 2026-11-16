import {
  ActionIcon,
  Checkbox,
  Chip,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoneyInput } from '@web/shared/components/MoneyInput';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { type OptionType, useCatalogueAdmin, useOptionTypes } from './api';
import { useLocalized } from './components';
import classes from './catalogue.module.css';

export interface VariantRow {
  key: string;
  valueIds: string[];
  selected: boolean;
  stock: number | string;
  price: string;
  barcode: string;
}

interface Value {
  optionTypeIds: string[];
  rows: VariantRow[];
  sharedBarcode: string;
}

const MAX_TYPES = 3;

function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((v) => [...prefix, v])),
    [[]],
  );
}

/** Pick options and values; every combination is listed and only ticked ones become items. */
export function VariantSection({
  value,
  onChange,
  error,
}: {
  value: Value;
  onChange: (v: Value) => void;
  error?: string | undefined;
}) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const errorMessage = useErrorMessage();
  const types = useOptionTypes();
  const admin = useCatalogueAdmin();
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [newValue, setNewValue] = useState<Record<string, string>>({});
  const available = (types.data ?? []).filter((ty) => ty.key !== 'number');
  const valueName = new Map(
    (types.data ?? []).flatMap((ty) => ty.values.map((v) => [v.id, localized(v.value)] as const)),
  );

  const rebuild = (typeIds: string[], nextPicked: Record<string, string[]>) => {
    const lists = typeIds.map((id) => nextPicked[id] ?? []);
    const combos = typeIds.length && lists.every((l) => l.length) ? cartesian(lists) : [];
    const old = new Map(value.rows.map((r) => [r.key, r]));
    const rows = combos.map((valueIds) => {
      const key = [...valueIds].sort().join('+');
      return old.get(key) ?? { key, valueIds, selected: true, stock: 1, price: '', barcode: '' };
    });
    onChange({ ...value, optionTypeIds: typeIds, rows });
  };

  const toggleType = (ids: string[]) => {
    if (ids.length > MAX_TYPES) return;
    const ordered = available.map((ty) => ty.id).filter((id) => ids.includes(id));
    rebuild(ordered, picked);
  };

  const toggleValues = (typeId: string, ids: string[]) => {
    const next = { ...picked, [typeId]: ids };
    setPicked(next);
    rebuild(value.optionTypeIds, next);
  };

  const addValue = (type: OptionType) => {
    const text = newValue[type.id]?.trim();
    if (!text) return;
    admin.createOptionValue.mutate(
      { typeId: type.id, value: { ar: text } },
      {
        onSuccess: (created) => {
          setNewValue((s) => ({ ...s, [type.id]: '' }));
          toggleValues(type.id, [...(picked[type.id] ?? []), created.id]);
        },
        onError: (e) => notifications.show({ color: 'red', message: errorMessage(e) }),
      },
    );
  };

  const patchRow = (key: string, patch: Partial<VariantRow>) =>
    onChange({ ...value, rows: value.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {t('catalogue.variants.options')}
        </Text>
        <Chip.Group multiple value={value.optionTypeIds} onChange={toggleType}>
          <Group gap="xs">
            {available.map((ty) => (
              <Chip key={ty.id} value={ty.id}>
                {localized(ty.name)}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </Stack>
      {value.optionTypeIds.map((typeId) => {
        const type = available.find((ty) => ty.id === typeId);
        if (!type) return null;
        return (
          <Stack key={typeId} gap={4}>
            <Text size="sm" fw={500}>
              {localized(type.name)}
            </Text>
            <Chip.Group
              multiple
              value={picked[typeId] ?? []}
              onChange={(ids) => toggleValues(typeId, ids)}
            >
              <Group gap={6}>
                {type.values.map((v) => (
                  <Chip key={v.id} value={v.id} size="sm" variant="outline">
                    {localized(v.value)}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
            <Group gap={4} maw={320}>
              <TextInput
                size="xs"
                style={{ flex: 1 }}
                placeholder={t('catalogue.variants.newValue')}
                value={newValue[typeId] ?? ''}
                onChange={(e) => {
                  const text = e.currentTarget.value;
                  setNewValue((s) => ({ ...s, [typeId]: text }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addValue(type);
                  }
                }}
              />
              <ActionIcon
                variant="default"
                aria-label={t('common.add')}
                onClick={() => addValue(type)}
                loading={admin.createOptionValue.isPending}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
          </Stack>
        );
      })}
      {value.rows.length > 0 && (
        <div className={classes.comboGrid}>
          <Table verticalSpacing={4} fz="sm" miw={560}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={36} />
                <Table.Th>{t('catalogue.variants.combination')}</Table.Th>
                <Table.Th w={100}>{t('catalogue.stock')}</Table.Th>
                <Table.Th w={120}>{t('catalogue.variants.ownPrice')}</Table.Th>
                <Table.Th w={170}>{t('catalogue.barcode')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {value.rows.map((r) => (
                <Table.Tr key={r.key} style={{ opacity: r.selected ? 1 : 0.5 }}>
                  <Table.Td>
                    <Checkbox
                      checked={r.selected}
                      onChange={(e) => patchRow(r.key, { selected: e.currentTarget.checked })}
                      aria-label={t('catalogue.variants.include')}
                    />
                  </Table.Td>
                  <Table.Td>{r.valueIds.map((id) => valueName.get(id)).join(' · ')}</Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      min={0}
                      max={100000}
                      allowDecimal={false}
                      value={r.stock}
                      disabled={!r.selected}
                      onChange={(v) => patchRow(r.key, { stock: v })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <MoneyInput
                      size="xs"
                      value={r.price}
                      disabled={!r.selected}
                      onChange={(v) => patchRow(r.key, { price: v })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      dir="ltr"
                      value={r.barcode}
                      disabled={!r.selected}
                      onChange={(e) => patchRow(r.key, { barcode: e.currentTarget.value })}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}
      <TextInput
        label={t('catalogue.variants.sharedBarcode')}
        description={t('catalogue.variants.sharedBarcodeHint')}
        dir="ltr"
        maw={320}
        value={value.sharedBarcode}
        onChange={(e) => onChange({ ...value, sharedBarcode: e.currentTarget.value })}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
      />
    </Stack>
  );
}

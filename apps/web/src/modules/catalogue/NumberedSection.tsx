import {
  ActionIcon,
  ColorInput,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { type ImageView, suggestedMarkerColors } from '@organza/shared';
import { IconTrash } from '@tabler/icons-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MoneyInput } from '@web/shared/components/MoneyInput';
import { PhotosField } from './PhotosField';
import classes from './catalogue.module.css';

export interface NumberedPoint {
  number: number;
  x: number;
  y: number;
  stock: number | string;
  price: string;
}

interface Value {
  points: NumberedPoint[];
  textColor: string;
  backgroundColor: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Tap the photo where each shawl is; each tap adds the next number at that spot. */
export function NumberedSection({
  images,
  onImagesChange,
  value,
  onChange,
  error,
}: {
  images: ImageView[];
  onImagesChange: (images: ImageView[]) => void;
  value: Value;
  onChange: (v: Value) => void;
  error?: string | undefined;
}) {
  const { t } = useTranslation();
  const main = images[0];

  const place = (e: MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = round2(((e.clientX - box.left) / box.width) * 100);
    const y = round2(((e.clientY - box.top) / box.height) * 100);
    const next = value.points.reduce((m, p) => Math.max(m, p.number), 0) + 1;
    onChange({ ...value, points: [...value.points, { number: next, x, y, stock: 1, price: '' }] });
  };

  const changeImages = (next: ImageView[]) => {
    onImagesChange(next);
    if (next[0] && next[0].id !== main?.id) {
      const colors = suggestedMarkerColors(
        next[0].brightness === null ? null : Number(next[0].brightness),
      );
      onChange({ ...value, textColor: colors.text, backgroundColor: colors.background });
    }
  };

  const patch = (i: number, p: Partial<NumberedPoint>) =>
    onChange({ ...value, points: value.points.map((pt, j) => (j === i ? { ...pt, ...p } : pt)) });

  return (
    <Stack gap="md">
      <PhotosField value={images} onChange={changeImages} label={t('catalogue.numbered.photo')} />
      {main && (
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {t('catalogue.numbered.tapHint')}
          </Text>
          <div className={classes.pointCanvas} onClick={place} role="presentation">
            <img src={main.mediumUrl} alt="" draggable={false} />
            {value.points.map((p) => (
              <span
                key={p.number}
                className={classes.point}
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  color: value.textColor,
                  background: value.backgroundColor,
                }}
              >
                {p.number}
              </span>
            ))}
          </div>
        </Stack>
      )}
      <SimpleGrid cols={{ base: 1, xs: 2 }} maw={420}>
        <ColorInput
          label={t('catalogue.numbered.textColor')}
          value={value.textColor}
          onChange={(textColor) => onChange({ ...value, textColor })}
          format="hex"
        />
        <ColorInput
          label={t('catalogue.numbered.backgroundColor')}
          value={value.backgroundColor}
          onChange={(backgroundColor) => onChange({ ...value, backgroundColor })}
          format="hex"
        />
      </SimpleGrid>
      {value.points.length > 0 && (
        <Table verticalSpacing={4} fz="sm" maw={520}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={90}>{t('catalogue.number')}</Table.Th>
              <Table.Th w={100}>{t('catalogue.stock')}</Table.Th>
              <Table.Th>{t('catalogue.variants.ownPrice')}</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {value.points.map((p, i) => (
              <Table.Tr key={`${p.number}-${i}`}>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={1}
                    max={10000}
                    allowDecimal={false}
                    value={p.number}
                    onChange={(v) => patch(i, { number: Number(v) || p.number })}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={0}
                    max={100000}
                    allowDecimal={false}
                    value={p.stock}
                    onChange={(v) => patch(i, { stock: v })}
                  />
                </Table.Td>
                <Table.Td>
                  <MoneyInput size="xs" value={p.price} onChange={(v) => patch(i, { price: v })} />
                </Table.Td>
                <Table.Td>
                  <Group justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={t('common.remove')}
                      onClick={() =>
                        onChange({ ...value, points: value.points.filter((_, j) => j !== i) })
                      }
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}

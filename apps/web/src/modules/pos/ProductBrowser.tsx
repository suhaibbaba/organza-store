import { Badge, Chip, Group, Loader, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconBarcode, IconPhoto, IconSearch } from '@tabler/icons-react';
import { type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategories, useProducts } from '@web/modules/catalogue/api';
import { useLocalized, useMoney } from '@web/modules/catalogue/components';
import classes from '../sales/sales.module.css';

const looksLikeCode = (value: string) =>
  /^[\w-]{4,}$/.test(value.trim()) && !/\s/.test(value.trim());

/** Search (always focused on desktop), category chips and a photo grid of what is on sale. */
export function ProductBrowser({
  searchRef,
  onProduct,
  onCode,
}: {
  searchRef?: RefObject<HTMLInputElement | null>;
  onProduct: (productId: string) => void;
  /** A typed or scanned code; resolves false when nothing has it (then it stays a search). */
  onCode: (code: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const money = useMoney();
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [debounced] = useDebouncedValue(q, 200);
  const categories = useCategories();
  const products = useProducts({
    q: debounced || undefined,
    categoryId,
    status: 'ACTIVE',
    pageSize: 60,
    page: 1,
  });
  const chips = (categories.data ?? [])
    .filter((c) => !c.archivedAt)
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.sortOrder - b.sortOrder);

  return (
    <>
      <TextInput
        ref={searchRef}
        size="md"
        autoFocus
        leftSection={<IconSearch size={18} />}
        rightSection={products.isFetching ? <Loader size="xs" /> : <IconBarcode size={18} />}
        placeholder={t('pos.searchHint')}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !q.trim()) return;
          e.preventDefault();
          const value = q.trim();
          if (looksLikeCode(value))
            void onCode(value).then((found) => {
              if (found) setQ('');
            });
          else if (products.data?.items.length === 1) {
            onProduct(products.data.items[0]!.id);
            setQ('');
          }
        }}
      />
      <div className={classes.categories}>
        <Chip.Group
          multiple={false}
          value={categoryId ?? ''}
          onChange={(v) => setCategoryId(v || null)}
        >
          <Group gap={6} wrap="nowrap">
            <Chip value="" size="sm">
              {t('catalogue.status.ALL')}
            </Chip>
            {chips.map((c) => (
              <Chip key={c.id} value={c.id} size="sm">
                {localized(c.name)}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </div>
      <div className={`${classes.grid} organza-scroll`}>
        {(products.data?.items ?? []).map((p) => (
          <button
            key={p.id}
            type="button"
            className={classes.tile}
            disabled={p.available <= 0}
            onClick={() => onProduct(p.id)}
          >
            {p.thumbnailUrl ? (
              <img className={classes.tileImage} src={p.thumbnailUrl} alt="" loading="lazy" />
            ) : (
              <div className={classes.tileImage}>
                <IconPhoto size={28} />
              </div>
            )}
            <div className={classes.tileBody}>
              <Text size="sm" fw={600} lineClamp={2}>
                {localized(p.name)}
              </Text>
              <Group justify="space-between" gap={4} wrap="nowrap">
                <Text size="sm">
                  {p.minPrice === p.maxPrice ? money(p.price) : `${money(p.minPrice)}+`}
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  color={p.available <= 0 ? 'red' : p.lowStock ? 'orange' : 'gray'}
                >
                  {p.available}
                </Badge>
              </Group>
            </div>
          </button>
        ))}
        {products.data?.items.length === 0 && (
          <Text c="dimmed" ta="center" py="xl" style={{ gridColumn: '1 / -1' }}>
            {t('pos.nothingFound')}
          </Text>
        )}
      </div>
    </>
  );
}

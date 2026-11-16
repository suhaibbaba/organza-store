import {
  Badge,
  Button,
  Group,
  Image,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { localize, type ProductView } from '@organza/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { catalogueKeys, lookupCode } from '@web/modules/catalogue/api';
import { useMoney } from '@web/modules/catalogue/components';
import { api } from '@web/shared/lib/api-client';
import type { CartLine } from './cart';

type Pickable = Omit<CartLine, 'key' | 'quantity' | 'discount'>;

/**
 * Turns a tapped product or a scanned code into a cart line. A product with several items
 * (sizes, colours, numbered shawls, or a supplier code shared by all) opens a picker.
 */
export function useItemChooser(
  onPick: (line: Pickable) => void,
  /** Receiving goods: items with nothing on the shelf can be picked too. */
  anyStock = false,
) {
  const client = useQueryClient();
  const { i18n } = useTranslation();
  const [choice, setChoice] = useState<{ product: ProductView; itemIds: string[] } | null>(null);

  const product = (id: string) =>
    client.fetchQuery({
      queryKey: catalogueKeys.product(id),
      queryFn: () => api.get<ProductView>(`/products/${id}`),
      staleTime: 15_000,
    });

  const toLine = (p: ProductView, itemId: string): Pickable => {
    const item = p.items.find((i) => i.id === itemId)!;
    const image =
      p.images.find((im) => im.itemId === item.id) ??
      p.images.find((im) => im.isPrimary) ??
      p.images[0];
    return {
      itemId: item.id,
      productId: p.id,
      name: p.name,
      variantLabel:
        p.type === 'NUMBERED'
          ? `#${item.number}`
          : item.options.map((o) => localize(o.value, i18n.language)).join(' · ') || null,
      sku: item.sku,
      imageUrl: image?.thumbnailUrl ?? null,
      unitPrice: item.effectivePrice,
      available: item.stock.available,
    };
  };

  const sellable = (p: ProductView) => p.items.filter((i) => i.isActive && !i.archivedAt);

  const offer = (p: ProductView, itemIds: string[]) => {
    if (itemIds.length === 1) onPick(toLine(p, itemIds[0]!));
    else if (itemIds.length > 1) setChoice({ product: p, itemIds });
  };

  return {
    /** A product tapped in the grid. */
    pickProduct: async (productId: string) => {
      const p = await product(productId);
      offer(
        p,
        sellable(p).map((i) => i.id),
      );
    },
    /** A scanned or typed code; resolves to false when no product has it. */
    pickCode: async (code: string): Promise<boolean> => {
      let hit: Awaited<ReturnType<typeof lookupCode>>;
      try {
        hit = await lookupCode(code);
      } catch {
        return false;
      }
      const p = await product(hit.productId);
      const items = sellable(p);
      offer(
        p,
        hit.itemId
          ? items.filter((i) => i.id === hit.itemId).map((i) => i.id)
          : items.map((i) => i.id),
      );
      return true;
    },
    picker: (
      <ChooseItem
        anyStock={anyStock}
        choice={choice}
        onClose={() => setChoice(null)}
        onPick={(p, itemId) => {
          onPick(toLine(p, itemId));
          setChoice(null);
        }}
      />
    ),
  };
}

function ChooseItem({
  anyStock,
  choice,
  onClose,
  onPick,
}: {
  anyStock: boolean;
  choice: { product: ProductView; itemIds: string[] } | null;
  onClose: () => void;
  onPick: (p: ProductView, itemId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const p = choice?.product;
  const items = p ? p.items.filter((i) => choice.itemIds.includes(i.id)) : [];
  const photo = p?.images.find((im) => im.isPrimary) ?? p?.images[0];
  return (
    <Modal
      opened={Boolean(choice)}
      onClose={onClose}
      title={p ? localize(p.name, i18n.language) : ''}
      centered
      size="lg"
      zIndex={400}
    >
      {p?.type === 'NUMBERED' && photo && (
        <Image src={photo.mediumUrl} radius="md" mah={260} fit="contain" mb="sm" alt="" />
      )}
      <SimpleGrid
        cols={{ base: p?.type === 'NUMBERED' ? 4 : 2, sm: p?.type === 'NUMBERED' ? 6 : 3 }}
        spacing="xs"
      >
        {items.map((item) => {
          const out = !anyStock && item.stock.available <= 0;
          const label =
            p!.type === 'NUMBERED'
              ? `#${item.number}`
              : item.options.map((o) => localize(o.value, i18n.language)).join(' · ') || item.sku;
          return (
            <UnstyledButton
              key={item.id}
              disabled={out}
              onClick={() => onPick(p!, item.id)}
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 8,
                padding: 10,
                opacity: out ? 0.45 : 1,
              }}
            >
              <Stack gap={2} align="center">
                <Text fw={700}>{label}</Text>
                <Text size="xs">{money(item.effectivePrice)}</Text>
                <Badge size="xs" variant="light" color={out ? 'red' : 'gray'}>
                  {t('catalogue.available', { count: item.stock.available })}
                </Badge>
              </Stack>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </Group>
    </Modal>
  );
}

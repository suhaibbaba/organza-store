import { Button, Group, Modal, NumberInput, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ProductView } from '@organza/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoneyInput } from '@web/shared/components/MoneyInput';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { api, newIdempotencyKey } from '@web/shared/lib/api-client';
import type { CartLine } from './cart';

/**
 * Quick sell (proposal B): a piece with no product yet. It becomes a real product with just a
 * name and a price, goes into the cart, and waits in "needs completing" for a manager.
 */
export function QuickSellDialog({
  opened,
  onClose,
  onReady,
}: {
  opened: boolean;
  onClose: () => void;
  onReady: (line: Omit<CartLine, 'key' | 'quantity' | 'discount'>) => void;
}) {
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [key, setKey] = useState(newIdempotencyKey);
  const create = useMutation({
    mutationFn: () =>
      api.post<ProductView>('/products/quick-sell', {
        idempotencyKey: key,
        name: { [i18n.language]: name.trim() },
        price: Number(price).toFixed(2),
        quantity,
      }),
  });
  const valid = name.trim().length > 0 && Number(price) > 0;

  const submit = async () => {
    try {
      const p = await create.mutateAsync();
      const item = p.items[0]!;
      onReady({
        itemId: item.id,
        productId: p.id,
        name: p.name,
        variantLabel: null,
        sku: item.sku,
        imageUrl: null,
        unitPrice: item.effectivePrice,
        available: item.stock.available,
      });
      setName('');
      setPrice('');
      setQuantity(1);
      setKey(newIdempotencyKey());
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('pos.quickSell')} centered>
      <Stack>
        <TextInput
          label={t('pos.quickSellName')}
          data-autofocus
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <MoneyInput label={t('catalogue.price')} required value={price} onChange={setPrice} />
        <NumberInput
          label={t('sales.quantity')}
          min={1}
          max={100}
          value={quantity}
          onChange={(v) => setQuantity(Math.max(1, Number(v) || 1))}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button disabled={!valid} loading={create.isPending} onClick={() => void submit()}>
            {t('pos.addToCart')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

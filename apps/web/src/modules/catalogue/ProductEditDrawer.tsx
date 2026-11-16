import {
  Button,
  ColorInput,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ProductView } from '@organza/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@web/modules/auth/session';
import { isMoney, MoneyInput } from '@web/shared/components/MoneyInput';
import { TranslatableInput } from '@web/shared/components/TranslatableInput';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { useCategories, useUpdateProduct } from './api';
import { useLocalized } from './components';

export function ProductEditDrawer({
  product,
  opened,
  onClose,
}: {
  product: ProductView;
  opened: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { can } = useSession();
  const localized = useLocalized();
  const errorMessage = useErrorMessage();
  const categories = useCategories();
  const update = useUpdateProduct();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [price, setPrice] = useState(product.price);
  const [compareAt, setCompareAt] = useState(product.compareAtPrice ?? '');
  const [threshold, setThreshold] = useState<number | string>(product.lowStockThreshold ?? '');
  const [textColor, setTextColor] = useState(product.pointTextColor ?? '#ffffff');
  const [bgColor, setBgColor] = useState(product.pointBackgroundColor ?? '#5b2a4d');

  const save = () => {
    if (!name.ar?.trim() || !isMoney(price) || (compareAt && !isMoney(compareAt))) {
      notifications.show({ color: 'red', message: t('errors.VALIDATION') });
      return;
    }
    update.mutate(
      {
        id: product.id,
        body: {
          version: product.version,
          name,
          description,
          ...(categoryId && { categoryId }),
          ...(can('products.editPrice') && price !== product.price && { price }),
          compareAtPrice: compareAt || null,
          lowStockThreshold: threshold === '' ? null : Number(threshold),
          ...(product.type === 'NUMBERED' && {
            pointTextColor: textColor,
            pointBackgroundColor: bgColor,
          }),
        },
      },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: t('common.saved') });
          onClose();
        },
        onError: (e) => notifications.show({ color: 'red', message: errorMessage(e) }),
      },
    );
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={t('catalogue.editProduct')}
      position="right"
      size="md"
    >
      <Stack gap="sm">
        <TranslatableInput label={t('catalogue.name')} value={name} onChange={setName} required />
        <Select
          label={t('catalogue.category')}
          searchable
          data={(categories.data ?? []).map((c) => ({ value: c.id, label: localized(c.name) }))}
          value={categoryId}
          onChange={setCategoryId}
        />
        <SimpleGrid cols={2}>
          <MoneyInput
            label={t('catalogue.price')}
            value={price}
            onChange={setPrice}
            disabled={!can('products.editPrice')}
          />
          <MoneyInput label={t('catalogue.compareAt')} value={compareAt} onChange={setCompareAt} />
        </SimpleGrid>
        <NumberInput
          label={t('catalogue.lowStockThreshold')}
          description={t('catalogue.lowStockThresholdHint')}
          min={0}
          max={10000}
          allowDecimal={false}
          value={threshold}
          onChange={setThreshold}
        />
        {product.type === 'NUMBERED' && (
          <SimpleGrid cols={2}>
            <ColorInput
              label={t('catalogue.numbered.textColor')}
              value={textColor}
              onChange={setTextColor}
              format="hex"
            />
            <ColorInput
              label={t('catalogue.numbered.backgroundColor')}
              value={bgColor}
              onChange={setBgColor}
              format="hex"
            />
          </SimpleGrid>
        )}
        <TranslatableInput
          label={t('catalogue.description')}
          value={description}
          onChange={setDescription}
          multiline
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={update.isPending}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

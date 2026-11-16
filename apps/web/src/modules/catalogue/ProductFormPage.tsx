import {
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { CreateProductInput, ImageView } from '@organza/shared';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { isMoney, MoneyInput } from '@web/shared/components/MoneyInput';
import { PageHeader } from '@web/shared/components/PageHeader';
import { TranslatableInput, type Translations } from '@web/shared/components/TranslatableInput';
import { ApiError, newIdempotencyKey } from '@web/shared/lib/api-client';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { useCategories, useCreateProduct } from './api';
import { useLocalized } from './components';
import { NumberedSection, type NumberedPoint } from './NumberedSection';
import { PhotosField } from './PhotosField';
import { VariantSection, type VariantRow } from './VariantSection';

type ProductType = 'REGULAR' | 'VARIANT' | 'NUMBERED';
const TYPES: Record<string, ProductType> = {
  regular: 'REGULAR',
  variant: 'VARIANT',
  numbered: 'NUMBERED',
};

/** Proposal C1: three short forms, one request, one transaction. */
export function ProductFormPage() {
  const { type: param } = useParams();
  const type = param ? TYPES[param] : undefined;
  if (!type) return <Navigate to="/products" replace />;
  return <ProductForm key={type} type={type} />;
}

function ProductForm({ type }: { type: ProductType }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSession();
  const localized = useLocalized();
  const errorMessage = useErrorMessage();
  const categories = useCategories();
  const create = useCreateProduct();
  const key = useRef(newIdempotencyKey());
  const isAdmin = user?.role === 'ADMIN';

  const [name, setName] = useState<Translations>({});
  const [description, setDescription] = useState<Translations>({});
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [compareAt, setCompareAt] = useState('');
  const [cost, setCost] = useState('');
  const [images, setImages] = useState<ImageView[]>([]);
  const [stock, setStock] = useState<number | string>(1);
  const [barcode, setBarcode] = useState('');
  const [variant, setVariant] = useState<{
    optionTypeIds: string[];
    rows: VariantRow[];
    sharedBarcode: string;
  }>({ optionTypeIds: [], rows: [], sharedBarcode: '' });
  const [numbered, setNumbered] = useState<{
    points: NumberedPoint[];
    textColor: string;
    backgroundColor: string;
  }>({
    points: [],
    textColor: '#ffffff',
    backgroundColor: '#5b2a4d',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.ar?.trim()) next['name'] = t('form.required');
    if (!categoryId) next['category'] = t('form.required');
    if (!isMoney(price)) next['price'] = t('form.money');
    if (compareAt && !isMoney(compareAt)) next['compareAt'] = t('form.money');
    if (cost && !isMoney(cost)) next['cost'] = t('form.money');
    if (type === 'VARIANT' && variant.rows.filter((r) => r.selected).length === 0)
      next['variants'] = t('catalogue.variants.pickOne');
    if (type === 'NUMBERED' && numbered.points.length === 0)
      next['points'] = t('catalogue.numbered.pickOne');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const payload = (): CreateProductInput => {
    const base = {
      name,
      description,
      categoryId: categoryId!,
      price,
      ...(compareAt && { compareAtPrice: compareAt }),
      ...(isAdmin && cost && { cost }),
      imageIds: images.map((i) => i.id),
      idempotencyKey: key.current,
    };
    if (type === 'REGULAR')
      return {
        type,
        ...base,
        stock: Number(stock) || 0,
        ...(barcode.trim() && { barcode: barcode.trim() }),
      };
    if (type === 'VARIANT') {
      return {
        type,
        ...base,
        optionTypeIds: variant.optionTypeIds,
        ...(variant.sharedBarcode.trim() && { sharedBarcode: variant.sharedBarcode.trim() }),
        items: variant.rows
          .filter((r) => r.selected)
          .map((r) => ({
            valueIds: r.valueIds,
            stock: Number(r.stock) || 0,
            ...(r.price && { price: r.price }),
            ...(r.barcode.trim() && { barcode: r.barcode.trim() }),
          })),
      };
    }
    return {
      type,
      ...base,
      pointTextColor: numbered.textColor,
      pointBackgroundColor: numbered.backgroundColor,
      items: numbered.points.map((p) => ({
        number: p.number,
        stock: Number(p.stock) || 0,
        photoX: p.x,
        photoY: p.y,
        ...(p.price && { price: p.price }),
      })),
    };
  };

  const submit = () => {
    if (!validate()) return;
    create.mutate(payload(), {
      onSuccess: (product) => {
        key.current = newIdempotencyKey();
        notifications.show({
          color: 'green',
          message: t('catalogue.created', { number: product.number }),
        });
        navigate(`/products/${product.id}`, { replace: true });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'BARCODE_TAKEN') {
          const holder = (
            error.body?.details as
              { holders?: { code: string; productNumber: number }[] } | undefined
          )?.holders?.[0];
          notifications.show({
            color: 'red',
            message: t('errors.BARCODE_TAKEN_BY', {
              code: holder?.code,
              number: holder?.productNumber,
            }),
          });
          return;
        }
        notifications.show({ color: 'red', message: errorMessage(error) });
      },
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <PageHeader
        title={t(`catalogue.new.${type}`)}
        back={{ to: '/products', label: t('catalogue.products') }}
      />
      <Stack gap="md" maw={960}>
        <Card withBorder>
          <Stack gap="sm">
            <TranslatableInput
              label={t('catalogue.name')}
              value={name}
              onChange={setName}
              required
              error={errors['name']}
            />
            <Select
              label={t('catalogue.category')}
              required
              searchable
              data={(categories.data ?? []).map((c) => ({ value: c.id, label: localized(c.name) }))}
              value={categoryId}
              onChange={setCategoryId}
              error={errors['category']}
            />
            <SimpleGrid cols={{ base: 1, xs: isAdmin ? 3 : 2 }}>
              <MoneyInput
                label={t('catalogue.price')}
                required
                value={price}
                onChange={setPrice}
                error={errors['price']}
              />
              <MoneyInput
                label={t('catalogue.compareAt')}
                value={compareAt}
                onChange={setCompareAt}
                error={errors['compareAt']}
              />
              {isAdmin && (
                <MoneyInput
                  label={t('catalogue.cost')}
                  value={cost}
                  onChange={setCost}
                  error={errors['cost']}
                />
              )}
            </SimpleGrid>
            {type === 'REGULAR' && (
              <SimpleGrid cols={{ base: 1, xs: 2 }}>
                <NumberInput
                  label={t('catalogue.stock')}
                  min={0}
                  max={100000}
                  allowDecimal={false}
                  value={stock}
                  onChange={setStock}
                />
                <TextInput
                  label={t('catalogue.barcode')}
                  description={t('catalogue.barcodeHint')}
                  dir="ltr"
                  value={barcode}
                  onChange={(e) => setBarcode(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                />
              </SimpleGrid>
            )}
            <TranslatableInput
              label={t('catalogue.description')}
              value={description}
              onChange={setDescription}
              multiline
            />
          </Stack>
        </Card>
        {type !== 'NUMBERED' && (
          <Card withBorder>
            <PhotosField value={images} onChange={setImages} />
          </Card>
        )}
        {type === 'VARIANT' && (
          <Card withBorder>
            <Title order={4} size="h5" mb="sm">
              {t('catalogue.variants.title')}
            </Title>
            <VariantSection value={variant} onChange={setVariant} error={errors['variants']} />
          </Card>
        )}
        {type === 'NUMBERED' && (
          <Card withBorder>
            <NumberedSection
              images={images}
              onImagesChange={setImages}
              value={numbered}
              onChange={setNumbered}
              error={errors['points']}
            />
          </Card>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => navigate('/products')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={create.isPending}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

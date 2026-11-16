import {
  Button,
  Group,
  Modal,
  NumberInput,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ItemView, ProductView } from '@organza/shared';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isMoney, MoneyInput } from '@web/shared/components/MoneyInput';
import { newIdempotencyKey } from '@web/shared/lib/api-client';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import {
  useAddBarcode,
  useAddItems,
  useArchiveProduct,
  useOptionTypes,
  useSetCost,
  useUpdateItem,
} from './api';
import { useLocalized } from './components';

type Close = { onClose: () => void };

function useFail() {
  const errorMessage = useErrorMessage();
  return (e: unknown) => notifications.show({ color: 'red', message: errorMessage(e) });
}

export function ArchiveDialog({ product, onClose }: { product: ProductView } & Close) {
  const { t } = useTranslation();
  const fail = useFail();
  const archive = useArchiveProduct();
  const [stock, setStock] = useState<'WRITE_OFF' | 'KEEP'>('WRITE_OFF');
  const [reason, setReason] = useState('');
  const onHand = product.items.reduce((s, i) => s + i.stock.onHand + i.stock.damaged, 0);
  return (
    <Modal opened onClose={onClose} title={t('catalogue.archive.title')} centered>
      <Stack>
        <Text size="sm">{t('catalogue.archive.body')}</Text>
        {onHand > 0 && (
          <Radio.Group
            label={t('catalogue.archive.stockQuestion', { count: onHand })}
            value={stock}
            onChange={(v) => setStock(v as typeof stock)}
          >
            <Stack gap={6} className="ds-mt-xs">
              <Radio value="WRITE_OFF" label={t('catalogue.archive.writeOff')} />
              <Radio value="KEEP" label={t('catalogue.archive.keep')} />
            </Stack>
          </Radio.Group>
        )}
        <TextInput
          label={t('common.reason')}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            color="red"
            loading={archive.isPending}
            onClick={() =>
              archive.mutate(
                { id: product.id, stock, ...(reason && { reason }) },
                { onSuccess: onClose, onError: fail },
              )
            }
          >
            {t('catalogue.archive.confirm')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function AddItemsDialog({ product, onClose }: { product: ProductView } & Close) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const fail = useFail();
  const types = useOptionTypes();
  const add = useAddItems();
  const key = useRef(newIdempotencyKey());
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [number, setNumber] = useState<number | string>(
    Math.max(0, ...product.items.map((i) => i.number)) + 1,
  );
  const [stock, setStock] = useState<number | string>(1);
  const [price, setPrice] = useState('');

  const submit = () => {
    const common = { stock: Number(stock) || 0, ...(price && isMoney(price) && { price }) };
    const body =
      product.type === 'VARIANT'
        ? {
            idempotencyKey: key.current,
            variants: [
              {
                valueIds: product.optionTypes.map((ty) => values[ty.id]).filter(Boolean),
                ...common,
              },
            ],
          }
        : { idempotencyKey: key.current, numbers: [{ number: Number(number), ...common }] };
    add.mutate({ id: product.id, body }, { onSuccess: onClose, onError: fail });
  };

  return (
    <Modal opened onClose={onClose} title={t('catalogue.addItem')} centered>
      <Stack>
        {product.type === 'VARIANT' &&
          product.optionTypes.map((ty) => (
            <Select
              key={ty.id}
              label={localized(ty.name)}
              data={(types.data?.find((x) => x.id === ty.id)?.values ?? []).map((v) => ({
                value: v.id,
                label: localized(v.value),
              }))}
              value={values[ty.id] ?? null}
              onChange={(v) => setValues((s) => ({ ...s, [ty.id]: v }))}
              searchable
            />
          ))}
        {product.type === 'NUMBERED' && (
          <NumberInput
            label={t('catalogue.number')}
            min={1}
            max={10000}
            allowDecimal={false}
            value={number}
            onChange={setNumber}
          />
        )}
        <NumberInput
          label={t('catalogue.stock')}
          min={0}
          max={100000}
          allowDecimal={false}
          value={stock}
          onChange={setStock}
        />
        <MoneyInput label={t('catalogue.variants.ownPrice')} value={price} onChange={setPrice} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={add.isPending}>
            {t('common.add')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function AddBarcodeDialog({
  product,
  item,
  onClose,
}: { product: ProductView; item: ItemView | null } & Close) {
  const { t } = useTranslation();
  const fail = useFail();
  const add = useAddBarcode();
  const [code, setCode] = useState('');
  return (
    <Modal
      opened
      onClose={onClose}
      title={item ? t('catalogue.addCodeFor', { sku: item.sku }) : t('catalogue.addSharedCode')}
      centered
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim())
            add.mutate(
              { productId: product.id, code: code.trim(), ...(item && { itemId: item.id }) },
              { onSuccess: onClose, onError: fail },
            );
        }}
      >
        <Stack>
          <TextInput
            label={t('catalogue.barcode')}
            description={t('catalogue.scanIntoField')}
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={add.isPending}>
              {t('common.add')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function EditItemDialog({
  product,
  item,
  canEditPrice,
  onClose,
}: { product: ProductView; item: ItemView; canEditPrice: boolean } & Close) {
  const { t } = useTranslation();
  const fail = useFail();
  const update = useUpdateItem();
  const [price, setPrice] = useState(item.price ?? '');
  const [location, setLocation] = useState(item.location ?? '');
  const [active, setActive] = useState(item.isActive ? 'yes' : 'no');
  return (
    <Modal opened onClose={onClose} title={item.sku} centered>
      <Stack>
        <MoneyInput
          label={t('catalogue.variants.ownPrice')}
          description={t('catalogue.ownPriceHint')}
          value={price}
          onChange={setPrice}
          disabled={!canEditPrice}
        />
        <TextInput
          label={t('catalogue.location')}
          value={location}
          onChange={(e) => setLocation(e.currentTarget.value)}
        />
        <Radio.Group label={t('catalogue.sellable')} value={active} onChange={setActive}>
          <Group className="ds-mt-xs">
            <Radio value="yes" label={t('common.yes')} />
            <Radio value="no" label={t('common.no')} />
          </Group>
        </Radio.Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                {
                  productId: product.id,
                  itemId: item.id,
                  body: {
                    ...(canEditPrice && (price || null) !== item.price && { price: price || null }),
                    location: location || null,
                    isActive: active === 'yes',
                  },
                },
                { onSuccess: onClose, onError: fail },
              )
            }
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function SetCostDialog({
  product,
  item,
  onClose,
}: { product: ProductView; item: ItemView } & Close) {
  const { t } = useTranslation();
  const fail = useFail();
  const setCost = useSetCost();
  const [cost, setCostValue] = useState('');
  return (
    <Modal opened onClose={onClose} title={t('catalogue.setCost', { sku: item.sku })} centered>
      <Stack>
        <Text size="sm">{t('catalogue.setCostHint')}</Text>
        <MoneyInput label={t('catalogue.cost')} value={cost} onChange={setCostValue} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!isMoney(cost)}
            loading={setCost.isPending}
            onClick={() =>
              setCost.mutate(
                { productId: product.id, itemId: item.id, cost },
                { onSuccess: onClose, onError: fail },
              )
            }
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

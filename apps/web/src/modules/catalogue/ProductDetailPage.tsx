import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import type { ItemView } from '@organza/shared';
import {
  IconBarcode,
  IconDots,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconPrinter,
  IconArchive,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { useProduct, useUpdateProduct } from './api';
import { StatusBadge, useLocalized, useMoney } from './components';
import {
  AddBarcodeDialog,
  AddItemsDialog,
  ArchiveDialog,
  EditItemDialog,
  SetCostDialog,
} from './ProductDialogs';
import { ProductEditDrawer } from './ProductEditDrawer';
import { ProductImages } from './ProductImages';
import classes from './catalogue.module.css';

type Dialog =
  | { kind: 'edit' }
  | { kind: 'archive' }
  | { kind: 'addItem' }
  | { kind: 'barcode'; item: ItemView | null }
  | { kind: 'item'; item: ItemView }
  | { kind: 'cost'; item: ItemView }
  | null;

export function ProductDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { can, user } = useSession();
  const navigate = useNavigate();
  const localized = useLocalized();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const phone = useMediaQuery('(max-width: 48em)');
  const query = useProduct(id);
  const update = useUpdateProduct();
  const [dialog, setDialog] = useState<Dialog>(null);

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const p = query.data;
  const archived = p.status === 'ARCHIVED';
  const isAdmin = user?.role === 'ADMIN';
  const editable = can('products.edit') && !archived;

  const label = (item: ItemView) =>
    p.type === 'NUMBERED'
      ? `#${item.number}`
      : p.type === 'VARIANT'
        ? item.options.map((o) => localized(o.value)).join(' · ')
        : t('catalogue.type.REGULAR');

  const toggleHidden = () =>
    update.mutate(
      {
        id: p.id,
        body: { version: p.version, status: p.status === 'HIDDEN' ? 'ACTIVE' : 'HIDDEN' },
      },
      { onError: (e) => notifications.show({ color: 'red', message: errorMessage(e) }) },
    );

  const stockCell = (item: ItemView) => (
    <Group gap={4} wrap="nowrap">
      <Text size="sm" fw={600}>
        {item.stock.available}
      </Text>
      {item.stock.reserved > 0 && (
        <Badge size="xs" variant="light" color="blue">
          {t('catalogue.reserved', { count: item.stock.reserved })}
        </Badge>
      )}
      {item.stock.damaged > 0 && (
        <Badge size="xs" variant="light" color="red">
          {t('catalogue.damaged', { count: item.stock.damaged })}
        </Badge>
      )}
    </Group>
  );

  const itemActions = (item: ItemView) =>
    editable && (
      <Menu position="bottom-end">
        <Menu.Target>
          <ActionIcon variant="subtle" aria-label={t('common.more')}>
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconEdit size={14} />}
            onClick={() => setDialog({ kind: 'item', item })}
          >
            {t('common.edit')}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconBarcode size={14} />}
            onClick={() => setDialog({ kind: 'barcode', item })}
          >
            {t('catalogue.addCode')}
          </Menu.Item>
          {isAdmin && item.avgCost === null && (
            <Menu.Item onClick={() => setDialog({ kind: 'cost', item })}>
              {t('catalogue.setCostShort')}
            </Menu.Item>
          )}
          {can('stock.history') && (
            <Menu.Item component={Link} to={`/stock?item=${item.id}`}>
              {t('stock.history')}
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    );

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Anchor component={Link} to="/products" size="sm">
            {t('catalogue.products')}
          </Anchor>
          <Group gap="xs">
            <Title order={2} size="h3">
              {localized(p.name)}
            </Title>
            <StatusBadge status={p.status} />
          </Group>
          <Text size="sm" c="dimmed">
            #{p.number} · {t(`catalogue.type.${p.type}`)} · {money(p.price)}
            {p.compareAtPrice && (
              <Text span td="line-through" ms={6} size="sm">
                {money(p.compareAtPrice)}
              </Text>
            )}
          </Text>
        </Stack>
        <Group gap="xs">
          {editable && (
            <Button
              variant="default"
              leftSection={<IconEdit size={16} />}
              onClick={() => setDialog({ kind: 'edit' })}
            >
              {t('common.edit')}
            </Button>
          )}
          {can('labels.print') && (
            <Button
              variant="default"
              leftSection={<IconPrinter size={16} />}
              onClick={() => navigate(`/labels?products=${p.id}`)}
            >
              {t('labels.print')}
            </Button>
          )}
          {!archived && (can('products.hide') || can('products.archive')) && (
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="default" size="lg" aria-label={t('common.more')}>
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {can('products.hide') && (
                  <Menu.Item
                    leftSection={
                      p.status === 'HIDDEN' ? <IconEye size={14} /> : <IconEyeOff size={14} />
                    }
                    onClick={toggleHidden}
                  >
                    {p.status === 'HIDDEN' ? t('catalogue.show') : t('catalogue.hide')}
                  </Menu.Item>
                )}
                {can('products.archive') && (
                  <Menu.Item
                    color="red"
                    leftSection={<IconArchive size={14} />}
                    onClick={() => setDialog({ kind: 'archive' })}
                  >
                    {t('catalogue.archive.action')}
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>

      <Stack gap="md">
        <Card withBorder>
          <ProductImages productId={p.id} images={p.images} />
          {p.type === 'NUMBERED' && p.images[0] && (
            <div className={classes.pointCanvas} style={{ cursor: 'default', marginTop: 12 }}>
              <img src={p.images[0].mediumUrl} alt="" />
              {p.items
                .filter((i) => i.photoX !== null && i.photoY !== null)
                .map((i) => (
                  <span
                    key={i.id}
                    className={classes.point}
                    style={{
                      left: `${i.photoX}%`,
                      top: `${i.photoY}%`,
                      color: p.pointTextColor ?? '#fff',
                      background: p.pointBackgroundColor ?? '#5b2a4d',
                      opacity: i.stock.available > 0 ? 1 : 0.4,
                    }}
                  >
                    {i.number}
                  </span>
                ))}
            </div>
          )}
        </Card>

        <Card withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={4} size="h5">
              {t('catalogue.items', { count: p.items.length })}
            </Title>
            {editable && p.type !== 'REGULAR' && can('products.create') && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => setDialog({ kind: 'addItem' })}
              >
                {t('catalogue.addItem')}
              </Button>
            )}
          </Group>
          {phone ? (
            <Stack gap="xs">
              {p.items.map((item) => (
                <Card
                  key={item.id}
                  withBorder
                  padding="xs"
                  style={{ opacity: item.isActive ? 1 : 0.5 }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2}>
                      <Text fw={600} size="sm">
                        {label(item)}
                      </Text>
                      <Text size="xs" c="dimmed" dir="ltr" ta="start">
                        {item.sku} · {item.barcodes.map((b) => b.code).join(', ')}
                      </Text>
                      <Group gap={6}>
                        <Text size="sm">{money(item.effectivePrice)}</Text>
                        {stockCell(item)}
                      </Group>
                    </Stack>
                    {itemActions(item)}
                  </Group>
                </Card>
              ))}
            </Stack>
          ) : (
            <Table verticalSpacing={6} fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    {p.type === 'NUMBERED'
                      ? t('catalogue.number')
                      : t('catalogue.variants.combination')}
                  </Table.Th>
                  <Table.Th>{t('catalogue.sku')}</Table.Th>
                  <Table.Th>{t('catalogue.barcode')}</Table.Th>
                  <Table.Th>{t('catalogue.price')}</Table.Th>
                  <Table.Th>{t('stock.available')}</Table.Th>
                  {isAdmin && <Table.Th>{t('catalogue.avgCost')}</Table.Th>}
                  <Table.Th w={40} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {p.items.map((item) => (
                  <Table.Tr key={item.id} style={{ opacity: item.isActive ? 1 : 0.5 }}>
                    <Table.Td>{label(item)}</Table.Td>
                    <Table.Td dir="ltr" style={{ textAlign: 'start' }}>
                      {item.sku}
                    </Table.Td>
                    <Table.Td dir="ltr" style={{ textAlign: 'start' }}>
                      {item.barcodes.map((b) => b.code).join(', ')}
                    </Table.Td>
                    <Table.Td>{money(item.effectivePrice)}</Table.Td>
                    <Table.Td>{stockCell(item)}</Table.Td>
                    {isAdmin && (
                      <Table.Td>
                        {item.avgCost === null || item.avgCost === undefined ? (
                          <Badge color="orange" variant="light" size="sm">
                            {t('catalogue.costUnknown')}
                          </Badge>
                        ) : (
                          money(item.avgCost)
                        )}
                      </Table.Td>
                    )}
                    <Table.Td>{itemActions(item)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {(p.sharedBarcodes.length > 0 || (editable && p.type !== 'REGULAR')) && (
            <Group gap="xs" mt="sm">
              <Text size="sm" c="dimmed">
                {t('catalogue.variants.sharedBarcode')}:
              </Text>
              {p.sharedBarcodes.map((c) => (
                <Badge key={c} variant="outline" style={{ direction: 'ltr' }}>
                  {c}
                </Badge>
              ))}
              {editable && p.type !== 'REGULAR' && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => setDialog({ kind: 'barcode', item: null })}
                >
                  {t('common.add')}
                </Button>
              )}
            </Group>
          )}
        </Card>
      </Stack>

      {dialog?.kind === 'edit' && (
        <ProductEditDrawer product={p} opened onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'archive' && <ArchiveDialog product={p} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'addItem' && <AddItemsDialog product={p} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'barcode' && (
        <AddBarcodeDialog product={p} item={dialog.item} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'item' && (
        <EditItemDialog
          product={p}
          item={dialog.item}
          canEditPrice={can('products.editPrice')}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'cost' && (
        <SetCostDialog product={p} item={dialog.item} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

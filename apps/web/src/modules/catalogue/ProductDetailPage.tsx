import { BackLink } from '@web/shared/components/PageHeader';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Table,
  Text,
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
import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { AskApprovalDialog } from '@web/modules/sales/AskApprovalDialog';
import { useProduct, useReviewQuickSell, useUpdateProduct } from './api';
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
  | { kind: 'askHide' }
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
  const review = useReviewQuickSell();
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
      <Text size="sm" className="ds-bold">
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

  const showShared = p.sharedBarcodes.length > 0 || (editable && p.type !== 'REGULAR');
  const points = p.items.filter((i) => i.photoX !== null && i.photoY !== null);

  return (
    <>
      <BackLink to="/products" label={t('catalogue.products')} />
      <Group justify="space-between" wrap="wrap" gap="xs" className="ds-mb-lg">
        <Stack gap={2} className="ds-min-0">
          <Group gap="xs">
            <h1 className={classes.detailTitle}>{localized(p.name)}</h1>
            <StatusBadge status={p.status} />
          </Group>
          <Text size="sm" className="ds-muted">
            #{p.number} · {t(`catalogue.type.${p.type}`)} · {money(p.price)}
            {p.compareAtPrice && (
              <span className={`ds-strike ${classes.was}`}>{money(p.compareAtPrice)}</span>
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
          {!archived && (can('products.hide') || can('products.archive') || editable) && (
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="default" size="lg" aria-label={t('common.more')}>
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {(can('products.hide') || editable) && (
                  <Menu.Item
                    leftSection={
                      p.status === 'HIDDEN' ? <IconEye size={14} /> : <IconEyeOff size={14} />
                    }
                    onClick={() =>
                      can('products.hide') ? toggleHidden() : setDialog({ kind: 'askHide' })
                    }
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

      <div className={classes.detail}>
        <Stack gap="md" className="ds-min-0">
          {p.quickSoldAt && !p.completedAt && !p.oneOffAt && (
            <Alert color="orange" variant="light" title={t('catalogue.needsCompletion')}>
              <Stack gap="xs">
                <Text size="sm">{t('catalogue.quickSoldHint')}</Text>
                {can('products.reviewQuickSell') && (
                  <Group gap="xs">
                    <Button
                      size="xs"
                      disabled={!p.categoryId}
                      loading={review.isPending}
                      onClick={() =>
                        review.mutate(
                          { id: p.id, version: p.version, outcome: 'COMPLETED' },
                          {
                            onError: (e) =>
                              notifications.show({ color: 'red', message: errorMessage(e) }),
                          },
                        )
                      }
                    >
                      {t('catalogue.markCompleted')}
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      loading={review.isPending}
                      onClick={() =>
                        review.mutate(
                          { id: p.id, version: p.version, outcome: 'ONE_OFF' },
                          {
                            onError: (e) =>
                              notifications.show({ color: 'red', message: errorMessage(e) }),
                          },
                        )
                      }
                    >
                      {t('catalogue.markOneOff')}
                    </Button>
                  </Group>
                )}
              </Stack>
            </Alert>
          )}

          <Card withBorder padding={0}>
            <Group justify="space-between" className={classes.cardHead}>
              <h2 className="ds-heading">{t('catalogue.items', { count: p.items.length })}</h2>
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
              <div className={classes.rows}>
                {p.items.map((item) => (
                  <Group
                    key={item.id}
                    justify="space-between"
                    wrap="nowrap"
                    className={item.isActive ? undefined : 'ds-dimmed'}
                  >
                    <Stack gap={2} className="ds-min-0">
                      <Text size="sm" className="ds-bold">
                        {label(item)}
                      </Text>
                      <Text size="xs" className="ds-muted ds-ltr">
                        {item.sku} · {item.barcodes.map((b) => b.code).join(', ')}
                      </Text>
                      <Group gap={6}>
                        <Text size="sm">{money(item.effectivePrice)}</Text>
                        {stockCell(item)}
                      </Group>
                    </Stack>
                    {itemActions(item)}
                  </Group>
                ))}
              </div>
            ) : (
              <Table.ScrollContainer minWidth={560}>
                <Table verticalSpacing={6}>
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
                      <Table.Th className="ds-col-actions" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {p.items.map((item) => (
                      <Table.Tr key={item.id} className={item.isActive ? undefined : 'ds-dimmed'}>
                        <Table.Td>{label(item)}</Table.Td>
                        <Table.Td className="ds-ltr">{item.sku}</Table.Td>
                        <Table.Td className="ds-ltr">
                          {item.barcodes.map((b) => b.code).join(', ')}
                        </Table.Td>
                        <Table.Td className="ds-nowrap">{money(item.effectivePrice)}</Table.Td>
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
              </Table.ScrollContainer>
            )}
          </Card>

          {p.type === 'NUMBERED' && p.images[0] && (
            <Card withBorder>
              <Stack gap="sm">
                <h2 className="ds-heading">{t('catalogue.numbered.photo')}</h2>
                <div className={`${classes.pointCanvas} ${classes.pointCanvasStatic}`}>
                  <img src={p.images[0].mediumUrl} alt="" />
                  {points.map((i) => (
                    <span
                      key={i.id}
                      className={
                        i.stock.available > 0
                          ? classes.point
                          : `${classes.point} ${classes.pointOut}`
                      }
                      style={
                        {
                          '--x': `${i.photoX}%`,
                          '--y': `${i.photoY}%`,
                          '--fg': p.pointTextColor ?? '#fff',
                          '--bg': p.pointBackgroundColor ?? '#5b2a4d',
                        } as CSSProperties
                      }
                    >
                      {i.number}
                    </span>
                  ))}
                </div>
              </Stack>
            </Card>
          )}
        </Stack>

        <Stack gap="md" className="ds-min-0">
          <Card withBorder>
            <Stack gap="sm">
              <h2 className="ds-heading">{t('catalogue.photos')}</h2>
              <ProductImages productId={p.id} images={p.images} />
            </Stack>
          </Card>
          {showShared && (
            <Card withBorder>
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <h2 className="ds-heading">{t('catalogue.variants.sharedBarcode')}</h2>
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
                {p.sharedBarcodes.length > 0 && (
                  <Group gap="xs">
                    {p.sharedBarcodes.map((c) => (
                      <Badge key={c} variant="outline" className="ds-ltr">
                        {c}
                      </Badge>
                    ))}
                  </Group>
                )}
              </Stack>
            </Card>
          )}
        </Stack>
      </div>

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
      <AskApprovalDialog
        opened={dialog?.kind === 'askHide'}
        title={p.status === 'HIDDEN' ? t('catalogue.show') : t('catalogue.hide')}
        request={{
          kind: 'PRODUCT_HIDE',
          productId: p.id,
          status: p.status === 'HIDDEN' ? 'ACTIVE' : 'HIDDEN',
        }}
        onClose={() => setDialog(null)}
      />
      {dialog?.kind === 'cost' && (
        <SetCostDialog product={p} item={dialog.item} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

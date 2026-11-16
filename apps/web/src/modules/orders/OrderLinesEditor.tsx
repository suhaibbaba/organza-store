import { ActionIcon, Button, Drawer, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { localize, multiplyMoney, type Translatable } from '@organza/shared';
import { IconMinus, IconPhoto, IconPlus, IconTrash } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoney } from '@web/modules/catalogue/components';
import { useItemChooser } from '@web/modules/pos/picking';
import { ProductBrowser } from '@web/modules/pos/ProductBrowser';
import { useBarcodeScanner } from '@web/shared/hooks/use-barcode-scanner';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import classes from './orders.module.css';

export interface DraftLine {
  itemId: string;
  name: Translatable;
  variantLabel: string | Translatable | null;
  sku: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
  /** Shown when the order is reserved: how many the shelf holds for it. */
  reserved?: number;
}

const label = (v: string | Translatable | null, lang: string) =>
  v === null ? '' : typeof v === 'string' ? v : localize(v, lang);

/** The lines of an order being taken or changed: add from the browser or the scanner. */
export function OrderLinesEditor({
  lines,
  onChange,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const [browsing, setBrowsing] = useState(false);
  const chooser = useItemChooser((p) => {
    const existing = lines.find((l) => l.itemId === p.itemId);
    if (existing)
      onChange(lines.map((l) => (l.itemId === p.itemId ? { ...l, quantity: l.quantity + 1 } : l)));
    else
      onChange([
        ...lines,
        {
          itemId: p.itemId,
          name: p.name,
          variantLabel: p.variantLabel,
          sku: p.sku,
          imageUrl: p.imageUrl,
          unitPrice: p.unitPrice,
          quantity: 1,
        },
      ]);
    setBrowsing(false);
  });
  const onCode = useCallback(
    async (code: string) => {
      try {
        const found = await chooser.pickCode(code);
        if (!found)
          notifications.show({ color: 'orange', message: t('pos.codeNotFound', { code }) });
        return found;
      } catch (e) {
        notifications.show({ color: 'red', message: errorMessage(e) });
        return false;
      }
    },
    [chooser, errorMessage, t],
  );
  useBarcodeScanner((code) => void onCode(code), !browsing);

  const setQuantity = (itemId: string, quantity: number) =>
    onChange(
      quantity <= 0
        ? lines.filter((l) => l.itemId !== itemId)
        : lines.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)),
    );

  return (
    <Stack gap="xs">
      {lines.length === 0 && (
        <Text size="sm" className="ds-muted">
          {t('orders.noLines')}
        </Text>
      )}
      {lines.map((l) => (
        <div key={l.itemId} className={classes.line}>
          {l.imageUrl ? (
            <img src={l.imageUrl} alt="" width={40} height={56} className={classes.thumb} />
          ) : (
            <div className={classes.thumb}>
              <IconPhoto size={16} />
            </div>
          )}
          <div className="ds-grow">
            <Text size="sm" truncate className="ds-bold">
              {localize(l.name, i18n.language)}
            </Text>
            <Text size="xs" truncate className="ds-muted">
              {[label(l.variantLabel, i18n.language), l.sku].filter(Boolean).join(' · ')}
            </Text>
            {l.reserved !== undefined && l.reserved < l.quantity && (
              <Text size="xs" className="ds-danger">
                {t('orders.reservedOf', { reserved: l.reserved, quantity: l.quantity })}
              </Text>
            )}
          </div>
          <Group gap={4} wrap="nowrap">
            <ActionIcon
              size="sm"
              variant="default"
              aria-label="-"
              onClick={() => setQuantity(l.itemId, l.quantity - 1)}
            >
              <IconMinus size={12} />
            </ActionIcon>
            <Text size="sm" className={`${classes.qty} ds-center ds-num`}>
              {l.quantity}
            </Text>
            <ActionIcon
              size="sm"
              variant="default"
              aria-label="+"
              onClick={() => setQuantity(l.itemId, l.quantity + 1)}
            >
              <IconPlus size={12} />
            </ActionIcon>
          </Group>
          <Text size="sm" className={`${classes.amount} ds-bold ds-end ds-num`}>
            {money(multiplyMoney(l.unitPrice, l.quantity))}
          </Text>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            aria-label={t('common.remove')}
            onClick={() => setQuantity(l.itemId, 0)}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </div>
      ))}
      <Group>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => setBrowsing(true)}
        >
          {t('returns.addItems')}
        </Button>
      </Group>
      {chooser.picker}
      <Drawer
        opened={browsing}
        onClose={() => setBrowsing(false)}
        position="bottom"
        size="90%"
        title={t('returns.addItems')}
      >
        <div className={classes.drawerBody}>
          {browsing && (
            <ProductBrowser
              onProduct={(id) =>
                void chooser
                  .pickProduct(id)
                  .catch((e: unknown) =>
                    notifications.show({ color: 'red', message: errorMessage(e) }),
                  )
              }
              onCode={onCode}
            />
          )}
        </div>
      </Drawer>
    </Stack>
  );
}

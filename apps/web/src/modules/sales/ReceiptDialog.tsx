import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ReceiptData } from '@organza/shared';
import { useEffect, useRef, useState } from 'react';
import { IconCash, IconPrinter } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PrintPortal } from '@web/shared/components/PrintPortal';
import { printPortal, RECEIPT_PAGE_CSS } from '@web/shared/lib/print';
import { printSettings, receiptPrinter } from '@web/shared/printing/printer';
import { fetchReceipt } from './api';
import { Receipt } from './Receipt';
import { isRtl, receiptBlocks } from './receipt-blocks';
import { paintReceipt } from './receipt-paint';
import classes from './sales.module.css';

/** Did this sale take cash in or give cash back? Then the drawer has to open. */
const movesCash = (data: ReceiptData) => data.sale.payments.some((p) => p.method === 'CASH');

/**
 * Prints a receipt the way this device prints: straight to the receipt printer in the desktop
 * app (with the drawer when asked), or through the browser's print dialog.
 */
export function usePrintReceipt() {
  const { t, i18n } = useTranslation();
  return async (data: ReceiptData, { gift = false, openDrawer = false } = {}) => {
    const printer = receiptPrinter.get();
    const settings = printSettings.get();
    if (printer.kind === 'browser' || !settings.printer) {
      printPortal(RECEIPT_PAGE_CSS);
      return;
    }
    try {
      const lang = i18n.language;
      const image = await paintReceipt(receiptBlocks(data, { gift, t, lang }), {
        rtl: isRtl(lang),
        paper: settings.paper,
      });
      await printer.printImage(image, { openDrawer });
    } catch (e) {
      notifications.show({
        color: 'red',
        message: t('device.printFailed', { reason: e instanceof Error ? e.message : String(e) }),
      });
    }
  };
}

/**
 * Shows a sale's receipt with a print button; used after checkout and from the sale page.
 * `fresh`: just sold at the till, so the desktop app may print it and open the drawer at once.
 */
export function ReceiptDialog({
  saleId,
  onClose,
  replayed,
  closeLabel,
  fresh = false,
}: {
  saleId: string | null;
  onClose: () => void;
  replayed?: boolean;
  closeLabel?: string;
  fresh?: boolean;
}) {
  const { t } = useTranslation();
  const [gift, setGift] = useState(false);
  const print = usePrintReceipt();
  const desktop = receiptPrinter.get().kind === 'escpos';
  const receipt = useQuery({
    queryKey: ['receipt', saleId],
    queryFn: () => fetchReceipt(saleId!),
    enabled: Boolean(saleId),
  });
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const data = receipt.data;
    if (!fresh || replayed || !desktop || !data || handled.current === data.sale.id) return;
    handled.current = data.sale.id;
    const settings = printSettings.get();
    const drawer = settings.drawerOnCash && movesCash(data);
    if (settings.autoPrint) void print(data, { openDrawer: drawer });
    else if (drawer)
      void receiptPrinter
        .get()
        .openDrawer()
        .catch(() => undefined);
  }, [fresh, replayed, desktop, receipt.data, print]);
  return (
    <Modal opened={Boolean(saleId)} onClose={onClose} title={t('sales.receipt')} centered size="sm">
      <Stack gap="sm">
        {replayed && (
          <Alert color="blue" variant="light">
            {t('pos.alreadySaved')}
          </Alert>
        )}
        <SegmentedControl
          value={gift ? 'gift' : 'full'}
          onChange={(v) => setGift(v === 'gift')}
          data={[
            { value: 'full', label: t('sales.receipt') },
            { value: 'gift', label: t('sales.giftReceipt') },
          ]}
        />
        {receipt.data ? (
          <div className={classes.receiptPreview}>
            <Receipt data={receipt.data} gift={gift} />
          </div>
        ) : (
          <Center py="xl">
            <Loader />
          </Center>
        )}
        <Group grow>
          <Button
            leftSection={<IconPrinter size={16} />}
            variant="light"
            disabled={!receipt.data}
            onClick={() => receipt.data && void print(receipt.data, { gift })}
          >
            {t('sales.print')}
          </Button>
          {desktop && (
            <Button
              variant="default"
              leftSection={<IconCash size={16} />}
              onClick={() =>
                void receiptPrinter
                  .get()
                  .openDrawer()
                  .catch(() => undefined)
              }
            >
              {t('device.openDrawer')}
            </Button>
          )}
          <Button data-autofocus onClick={onClose}>
            {closeLabel ?? t('common.close')}
          </Button>
        </Group>
      </Stack>
      {receipt.data && (
        <PrintPortal>
          <Receipt data={receipt.data} gift={gift} />
        </PrintPortal>
      )}
    </Modal>
  );
}

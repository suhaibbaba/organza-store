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
import { useState } from 'react';
import { IconPrinter } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PrintPortal } from '@web/shared/components/PrintPortal';
import { printPortal, RECEIPT_PAGE_CSS } from '@web/shared/lib/print';
import { fetchReceipt } from './api';
import { Receipt } from './Receipt';
import classes from './sales.module.css';

/** Shows a sale's receipt with a print button; used after checkout and from the sale page. */
export function ReceiptDialog({
  saleId,
  onClose,
  replayed,
  closeLabel,
}: {
  saleId: string | null;
  onClose: () => void;
  replayed?: boolean;
  closeLabel?: string;
}) {
  const { t } = useTranslation();
  const [gift, setGift] = useState(false);
  const receipt = useQuery({
    queryKey: ['receipt', saleId],
    queryFn: () => fetchReceipt(saleId!),
    enabled: Boolean(saleId),
  });
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
            onClick={() => printPortal(RECEIPT_PAGE_CSS)}
          >
            {t('sales.print')}
          </Button>
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

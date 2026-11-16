import { Badge, Image } from '@mantine/core';
import { localize } from '@organza/shared';
import { IconPhoto } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@web/shared/lib/format';
import { useDefaultCurrency } from '@web/modules/settings/api';
import classes from './catalogue.module.css';

export function ProductThumb({
  url,
  size = 48,
}: {
  url: string | null | undefined;
  size?: number;
}) {
  return url ? (
    <Image src={url} w={size} h={size * 1.5} radius="sm" fit="cover" alt="" loading="lazy" />
  ) : (
    <div className={classes.thumbEmpty} style={{ width: size, height: size * 1.5 }}>
      <IconPhoto size={size / 2.5} />
    </div>
  );
}

export function useLocalized() {
  const { i18n } = useTranslation();
  return (value: Parameters<typeof localize>[0]) => localize(value, i18n.language);
}

export function useMoney() {
  const { i18n } = useTranslation();
  const currency = useDefaultCurrency();
  return (amount: string | number) => formatMoney(amount, currency, i18n.language);
}

export function StatusBadge({ status }: { status: 'ACTIVE' | 'HIDDEN' | 'ARCHIVED' }) {
  const { t } = useTranslation();
  const color = status === 'ACTIVE' ? 'green' : status === 'HIDDEN' ? 'yellow' : 'gray';
  return (
    <Badge color={color} variant="light">
      {t(`catalogue.status.${status}`)}
    </Badge>
  );
}

export function StockBadge({ available, low }: { available: number; low: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge color={available <= 0 ? 'red' : low ? 'orange' : 'gray'} variant="light">
      {t('catalogue.available', { count: available })}
    </Badge>
  );
}

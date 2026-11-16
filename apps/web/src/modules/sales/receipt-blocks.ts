import { localize, type ReceiptData } from '@organza/shared';
import type { TFunction } from 'i18next';
import { formatDateTime, formatMoney } from '@web/shared/lib/format';

/**
 * What a receipt says, as a list of blocks. The screen and browser print render them as markup;
 * the Windows app paints the same blocks onto the thermal printer image, so both always agree.
 */
export type ReceiptBlock =
  | { kind: 'title'; text: string }
  | { kind: 'center'; text: string; ltr?: boolean }
  | { kind: 'meta'; start: string; end: string }
  | { kind: 'note'; text: string }
  | { kind: 'line'; name: string; amount: string; details: string[] }
  | { kind: 'row'; label: string; value: string; strong?: boolean }
  | { kind: 'rule' }
  | { kind: 'footer'; text: string };

/** `gift`: the gift receipt, without prices or payments (proposal C11). */
export function receiptBlocks(
  data: ReceiptData,
  { gift, t, lang }: { gift: boolean; t: TFunction; lang: string },
): ReceiptBlock[] {
  const money = (v: string) => formatMoney(v, data.currency, lang);
  const { sale, shop } = data;
  const out: ReceiptBlock[] = [{ kind: 'title', text: localize(shop.name, lang) }];
  const address = localize(shop.address, lang);
  if (address) out.push({ kind: 'center', text: address });
  if (shop.phone) out.push({ kind: 'center', text: shop.phone, ltr: true });
  out.push({ kind: 'meta', start: sale.number, end: formatDateTime(sale.createdAt, lang) });
  if (gift) out.push({ kind: 'note', text: t('sales.giftReceipt') });
  if (sale.customer && !gift) out.push({ kind: 'center', text: sale.customer.name });
  if (sale.mode === 'HELD') out.push({ kind: 'note', text: t('sales.heldReceipt') });
  out.push({ kind: 'rule' });

  for (const l of sale.lines) {
    const details: string[] = [];
    if (l.variantLabel) details.push(localize(l.variantLabel, lang));
    if (gift && l.quantity > 1) details.push(`× ${l.quantity}`);
    if (!gift && !l.giveaway && l.quantity > 1)
      details.push(`${l.quantity} × ${money(l.unitPrice)}`);
    if (!gift && Number(l.discount) > 0)
      details.push(`${t('sales.discount')} −${money(l.discount)}`);
    out.push({
      kind: 'line',
      name: localize(l.name, lang),
      amount: gift ? '' : l.giveaway ? t('pos.giveaway') : money(l.lineTotal),
      details,
    });
  }
  out.push({ kind: 'rule' });

  if (gift) {
    out.push({ kind: 'note', text: t('sales.giftReceiptNote') });
  } else {
    const row = (label: string, value: string, strong = false) =>
      out.push({ kind: 'row', label, value, strong });
    if (Number(sale.discountTotal) > 0) row(t('sales.discount'), `−${money(sale.discountTotal)}`);
    row(t('sales.total'), money(sale.total), true);
    for (const p of sale.payments.filter((x) => x.purpose !== 'CHANGE'))
      row(
        t(`sales.method.${p.method}`),
        p.currency === data.currency
          ? money(p.amount)
          : `${formatMoney(p.amount, p.currency, lang)} (${money(p.amountDefault)})`,
      );
    if (Number(sale.change) > 0) row(t('sales.change'), money(sale.change));
    if (Number(sale.creditKept) > 0) row(t('sales.creditKept'), money(sale.creditKept));
    if (Number(sale.owed) > 0) row(t('sales.remaining'), money(sale.owed), true);
    const balance = data.customerBalance === null ? null : Number(data.customerBalance);
    if (balance !== null && balance !== 0)
      row(
        balance > 0 ? t('sales.balanceOwed') : t('sales.balanceCredit'),
        money(String(Math.abs(balance))),
      );
    if (Number(sale.returnedTotal) > 0)
      row(t('sales.returnedTotal'), `−${money(sale.returnedTotal)}`);
  }
  const footer = localize(shop.footer, lang);
  if (footer) out.push({ kind: 'footer', text: footer });
  return out;
}

export const isRtl = (lang: string) => lang !== 'en';

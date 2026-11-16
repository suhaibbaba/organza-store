import { localize, type ReceiptData } from '@organza/shared';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatMoney } from '@web/shared/lib/format';
import classes from './sales.module.css';

/**
 * The printed (or shared) receipt, 80 mm wide. Plain markup so it prints the same from every
 * browser; the Windows app sends the same data to the receipt printer as ESC/POS (phase 7).
 */
/** `gift`: the gift receipt, without prices or payments (proposal C11). */
export function Receipt({ data, gift = false }: { data: ReceiptData; gift?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, data.currency, lang);
  const { sale, shop } = data;
  const owes = Number(sale.owed) > 0;
  const balance = data.customerBalance === null ? null : Number(data.customerBalance);
  return (
    <div className={classes.receipt} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <div className={classes.receiptHead}>
        <strong>{localize(shop.name, lang)}</strong>
        {localize(shop.address, lang) && <div>{localize(shop.address, lang)}</div>}
        {shop.phone && <div dir="ltr">{shop.phone}</div>}
      </div>
      <div className={classes.receiptMeta}>
        <span>{sale.number}</span>
        <span>{formatDateTime(sale.createdAt, lang)}</span>
      </div>
      {gift && <div className={classes.receiptNote}>{t('sales.giftReceipt')}</div>}
      {sale.customer && !gift && <div>{sale.customer.name}</div>}
      {sale.mode === 'HELD' && <div className={classes.receiptNote}>{t('sales.heldReceipt')}</div>}
      <table className={classes.receiptLines}>
        <tbody>
          {sale.lines.map((l) => (
            <tr key={l.id}>
              <td>
                {localize(l.name, lang)}
                {l.variantLabel && (
                  <div className={classes.receiptSmall}>{localize(l.variantLabel, lang)}</div>
                )}
                {gift && l.quantity > 1 && (
                  <div className={classes.receiptSmall}>× {l.quantity}</div>
                )}
                {l.quantity > 1 && !gift && !l.giveaway && (
                  <div className={classes.receiptSmall}>
                    {l.quantity} × {money(l.unitPrice)}
                  </div>
                )}
                {Number(l.discount) > 0 && !gift && (
                  <div className={classes.receiptSmall}>
                    {t('sales.discount')} −{money(l.discount)}
                  </div>
                )}
              </td>
              <td className={classes.receiptAmount}>
                {gift ? '' : l.giveaway ? t('pos.giveaway') : money(l.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {gift ? (
        <div className={classes.receiptNote}>{t('sales.giftReceiptNote')}</div>
      ) : (
        <div className={classes.receiptTotals}>
          {Number(sale.discountTotal) > 0 && (
            <Row label={t('sales.discount')} value={`−${money(sale.discountTotal)}`} />
          )}
          <Row label={t('sales.total')} value={money(sale.total)} strong />
          {sale.payments
            .filter((p) => p.purpose !== 'CHANGE')
            .map((p) => (
              <Row
                key={p.id}
                label={t(`sales.method.${p.method}`)}
                value={
                  p.currency === data.currency
                    ? money(p.amount)
                    : `${formatMoney(p.amount, p.currency, lang)} (${money(p.amountDefault)})`
                }
              />
            ))}
          {Number(sale.change) > 0 && <Row label={t('sales.change')} value={money(sale.change)} />}
          {Number(sale.creditKept) > 0 && (
            <Row label={t('sales.creditKept')} value={money(sale.creditKept)} />
          )}
          {owes && <Row label={t('sales.remaining')} value={money(sale.owed)} strong />}
          {balance !== null && balance !== 0 && (
            <Row
              label={balance > 0 ? t('sales.balanceOwed') : t('sales.balanceCredit')}
              value={money(String(Math.abs(balance)))}
            />
          )}
          {Number(sale.returnedTotal) > 0 && (
            <Row label={t('sales.returnedTotal')} value={`−${money(sale.returnedTotal)}`} />
          )}
        </div>
      )}
      {localize(shop.footer, lang) && (
        <div className={classes.receiptFoot}>{localize(shop.footer, lang)}</div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={classes.receiptRow} style={strong ? { fontWeight: 700 } : undefined}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

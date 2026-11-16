import type { ReceiptData } from '@organza/shared';
import { useTranslation } from 'react-i18next';
import { isRtl, type ReceiptBlock, receiptBlocks } from './receipt-blocks';
import classes from './sales.module.css';

/**
 * The printed (or shared) receipt, 80 mm wide. Plain markup so it prints the same from every
 * browser; the Windows app paints the same blocks onto the receipt printer (shared/printing).
 * `gift`: the gift receipt, without prices or payments (proposal C11).
 */
export function Receipt({ data, gift = false }: { data: ReceiptData; gift?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <div className={classes.receipt} dir={isRtl(lang) ? 'rtl' : 'ltr'}>
      {receiptBlocks(data, { gift, t, lang }).map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

function Block({ block: b }: { block: ReceiptBlock }) {
  switch (b.kind) {
    case 'title':
      return <div className={classes.receiptTitle}>{b.text}</div>;
    case 'center':
      return (
        <div className={classes.receiptCenter} dir={b.ltr ? 'ltr' : undefined}>
          {b.text}
        </div>
      );
    case 'meta':
      return (
        <div className={classes.receiptMeta}>
          <span>{b.start}</span>
          <span>{b.end}</span>
        </div>
      );
    case 'note':
      return <div className={classes.receiptNote}>{b.text}</div>;
    case 'rule':
      return <div className={classes.receiptRule} />;
    case 'line':
      return (
        <div className={classes.receiptLine}>
          <div>
            {b.name}
            {b.details.map((d) => (
              <div key={d} className={classes.receiptSmall}>
                {d}
              </div>
            ))}
          </div>
          <div className={classes.receiptAmount}>{b.amount}</div>
        </div>
      );
    case 'row':
      return (
        <div className={classes.receiptRow} style={b.strong ? { fontWeight: 700 } : undefined}>
          <span>{b.label}</span>
          <span>{b.value}</span>
        </div>
      );
    case 'footer':
      return <div className={classes.receiptFoot}>{b.text}</div>;
  }
}

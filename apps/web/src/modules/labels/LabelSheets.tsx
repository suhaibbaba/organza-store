import type { LabelData, ShopSettings } from '@organza/shared';
import { localize } from '@organza/shared';
import type { CSSProperties } from 'react';
import { BarcodeSvg } from '@web/shared/components/BarcodeSvg';
import classes from './labels.module.css';

export interface LabelCopy {
  label: LabelData;
  key: string;
}

type Layout = ShopSettings['label'];

/** One label, sized by the --label-w and --label-h of the sheet around it. */
function LabelBox({
  label,
  language,
  money,
}: {
  label: LabelData;
  language: string;
  money: (v: string) => string;
}) {
  const options = label.options.map((o) => localize(o, language)).join(' · ');
  return (
    <div className={classes.label}>
      <div className={classes.labelTop}>
        <span className={classes.labelName}>{localize(label.name, language)}</span>
        <span className={classes.labelPrice}>{money(label.price)}</span>
      </div>
      {options && <div className={classes.labelOptions}>{options}</div>}
      <div className={classes.labelBars}>
        <BarcodeSvg code={label.barcode} />
      </div>
    </div>
  );
}

/** Pages exactly as they print: one label per page on a thermal roll, or an A4 grid. */
export function LabelSheets({
  copies,
  layout,
  language,
  money,
}: {
  copies: LabelCopy[];
  layout: Layout;
  language: string;
  money: (v: string) => string;
}) {
  if (layout.mode === 'THERMAL') {
    return (
      <>
        {copies.map((c) => (
          <div
            key={c.key}
            className={`${classes.sheet} ${classes.thermal}`}
            style={
              {
                '--label-w': `${layout.widthMm}mm`,
                '--label-h': `${layout.heightMm}mm`,
              } as CSSProperties
            }
          >
            <LabelBox label={c.label} language={language} money={money} />
          </div>
        ))}
      </>
    );
  }
  const perPage = layout.columns * layout.rows;
  const pages: LabelCopy[][] = [];
  for (let i = 0; i < copies.length; i += perPage) pages.push(copies.slice(i, i + perPage));
  return (
    <>
      {pages.map((page, i) => (
        <div
          key={i}
          className={`${classes.sheet} ${classes.grid}`}
          style={
            {
              '--label-w': `${layout.widthMm}mm`,
              '--label-h': `${layout.heightMm}mm`,
              '--columns': layout.columns,
              '--margin-top': `${layout.marginTopMm}mm`,
              '--margin-right': `${layout.marginRightMm}mm`,
              '--margin-bottom': `${layout.marginBottomMm}mm`,
              '--margin-left': `${layout.marginLeftMm}mm`,
              '--gap-x': `${layout.gapXMm}mm`,
              '--gap-y': `${layout.gapYMm}mm`,
            } as CSSProperties
          }
        >
          {page.map((c) => (
            <LabelBox key={c.key} label={c.label} language={language} money={money} />
          ))}
        </div>
      ))}
    </>
  );
}

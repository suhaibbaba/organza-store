import type { LabelData, ShopSettings } from '@organza/shared';
import { localize } from '@organza/shared';
import { BarcodeSvg } from '@web/shared/components/BarcodeSvg';
import classes from './labels.module.css';

export interface LabelCopy {
  label: LabelData;
  key: string;
}

type Layout = ShopSettings['label'];

function LabelBox({
  label,
  language,
  money,
  layout,
}: {
  label: LabelData;
  language: string;
  money: (v: string) => string;
  layout: Layout;
}) {
  const options = label.options.map((o) => localize(o, language)).join(' · ');
  return (
    <div
      className={classes.label}
      style={{ width: `${layout.widthMm}mm`, height: `${layout.heightMm}mm` }}
    >
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
            className={classes.sheet}
            style={{ width: `${layout.widthMm}mm`, height: `${layout.heightMm}mm` }}
          >
            <LabelBox label={c.label} language={language} money={money} layout={layout} />
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
          style={{
            width: '210mm',
            height: '297mm',
            padding: `${layout.marginTopMm}mm ${layout.marginRightMm}mm ${layout.marginBottomMm}mm ${layout.marginLeftMm}mm`,
            gridTemplateColumns: `repeat(${layout.columns}, ${layout.widthMm}mm)`,
            gridAutoRows: `${layout.heightMm}mm`,
            columnGap: `${layout.gapXMm}mm`,
            rowGap: `${layout.gapYMm}mm`,
            boxSizing: 'border-box',
            direction: 'ltr',
          }}
        >
          {page.map((c) => (
            <LabelBox
              key={c.key}
              label={c.label}
              language={language}
              money={money}
              layout={layout}
            />
          ))}
        </div>
      ))}
    </>
  );
}

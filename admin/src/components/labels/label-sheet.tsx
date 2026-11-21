"use client";

import { useLocale } from "next-intl";
import { getTextDirection } from "@/constants/locale";
import { paginateLabels } from "@/lib/labels";
import { BarcodeSvg } from "@/components/labels/barcode-svg";
import type { AppLocale } from "@/i18n/routing";
import type { LabelGeometry, LabelPrintItem } from "@/types/label";

// One component draws both the preview and the printed page, in millimetres and black-on-white, so print matches preview.
function Label({ item, geometry, textDir }: { item: LabelPrintItem; geometry: LabelGeometry; textDir: "rtl" | "ltr" }) {
  return (
    <div className="label-box" style={{ width: `${geometry.widthMm}mm`, height: `${geometry.heightMm}mm` }}>
      <div className="label-text" dir={textDir}>
        <span className="label-name">{item.name}</span>
        {item.subtitle && <span className="label-variant">{item.subtitle}</span>}
      </div>
      {/* No price on the label: a price change would otherwise mean reprinting every sticker in the shop. */}
      <div className="label-code">{item.code ? <BarcodeSvg value={item.code} /> : null}</div>
    </div>
  );
}

export function LabelSheet({ items, geometry }: { items: readonly LabelPrintItem[]; geometry: LabelGeometry }) {
  const locale = useLocale();
  const textDir = getTextDirection(locale as AppLocale);
  const pages = paginateLabels(items, geometry);

  // The sheet is a picture of paper, so it runs left-to-right in every locale; only the text inside a label follows the locale.
  if (geometry.printMode === "A4_GRID") {
    return (
      <div className="label-sheet" dir="ltr">
        {pages.map((page, pageIndex) => (
          <div
            key={pageIndex}
            className="label-page label-page--a4"
            style={{
              paddingTop: `${geometry.pageMarginTopMm}mm`,
              paddingRight: `${geometry.pageMarginRightMm}mm`,
              paddingBottom: `${geometry.pageMarginBottomMm}mm`,
              paddingLeft: `${geometry.pageMarginLeftMm}mm`,
            }}
          >
            <div
              className="label-grid"
              style={{
                gridTemplateColumns: `repeat(${geometry.columns}, ${geometry.widthMm}mm)`,
                gridAutoRows: `${geometry.heightMm}mm`,
                columnGap: `${geometry.gapXMm}mm`,
                rowGap: `${geometry.gapYMm}mm`,
              }}
            >
              {page.map((item) => (
                <Label key={item.key} item={item} geometry={geometry} textDir={textDir} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Thermal: the page IS the label, one per page, no margins anywhere.
  return (
    <div className="label-sheet" dir="ltr">
      {items.map((item) => (
        <div
          key={item.key}
          className="label-page label-page--thermal"
          style={{ width: `${geometry.widthMm}mm`, height: `${geometry.heightMm}mm` }}
        >
          <Label item={item} geometry={geometry} textDir={textDir} />
        </div>
      ))}
    </div>
  );
}

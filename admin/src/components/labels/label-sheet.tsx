"use client";

import { useLocale } from "next-intl";
import { getTextDirection } from "@/constants/locale";
import { paginateLabels } from "@/lib/labels";
import { BarcodeSvg } from "@/components/labels/barcode-svg";
import type { AppLocale } from "@/i18n/routing";
import type { LabelGeometry, LabelPrintItem } from "@/types/label";

// The printed sheet. ONE component draws both the on-screen preview and the
// page the browser prints (see label-print-portal.tsx) — that is what makes
// "the print matches the preview" a fact rather than a hope. Everything is
// sized in millimetres so it lands on paper at exactly the configured size,
// and the colours are pinned to black-on-white: this is paper, and it must
// not follow the app's dark theme.

// A sticker: name on top, barcode filling whatever height is left.
function Label({ item, geometry, textDir }: { item: LabelPrintItem; geometry: LabelGeometry; textDir: "rtl" | "ltr" }) {
  return (
    <div className="label-box" style={{ width: `${geometry.widthMm}mm`, height: `${geometry.heightMm}mm` }}>
      <div className="label-text" dir={textDir}>
        <span className="label-name">{item.name}</span>
        {item.subtitle && <span className="label-variant">{item.subtitle}</span>}
      </div>
      {/* No price on the label, on purpose: a price change would otherwise
          mean reprinting every sticker in the shop. */}
      <div className="label-code">{item.code ? <BarcodeSvg value={item.code} /> : null}</div>
    </div>
  );
}

export function LabelSheet({ items, geometry }: { items: readonly LabelPrintItem[]; geometry: LabelGeometry }) {
  const locale = useLocale();
  const textDir = getTextDirection(locale as AppLocale);
  const pages = paginateLabels(items, geometry);

  // The sheet itself is laid out left-to-right in both locales: it is a
  // picture of a piece of paper, so the first sticker is the top-left one
  // whichever language the app is in. The text inside each label still runs
  // in the reading direction of the locale.
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

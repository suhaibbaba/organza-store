"use client";

import { useTranslations } from "next-intl";
import { LABEL_PREVIEW_MAX_PAGES } from "@/constants/labels";
import { mmToPx, paginateLabels, printedPageSizeMm } from "@/lib/labels";
import { useFitScale } from "@/hooks/use-fit-scale";
import { LabelSheet } from "@/components/labels/label-sheet";
import type { LabelGeometry, LabelPrintItem } from "@/types/label";

// The same <LabelSheet> the print portal renders, scaled on screen only — the printed copy is never transformed.
export function LabelPreview({ items, geometry }: { items: readonly LabelPrintItem[]; geometry: LabelGeometry }) {
  const t = useTranslations("labels.preview");
  const { widthMm, heightMm } = printedPageSizeMm(geometry);
  const sheetWidthPx = mmToPx(widthMm);
  const sheetHeightPx = mmToPx(heightMm);
  const { ref, scale } = useFitScale(sheetWidthPx);

  const pages = paginateLabels(items, geometry);
  // Only the preview stops early; everything still prints.
  const shownPages = pages.slice(0, LABEL_PREVIEW_MAX_PAGES);
  const shownItems = shownPages.flat();
  const isTruncated = shownPages.length < pages.length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-label text-ink-muted">{t("pageCount", { count: pages.length })}</p>

      <div ref={ref} dir="ltr" className="label-preview overflow-hidden rounded-panel border border-line bg-sunken p-3">
        <div
          // Reserves the scaled sheet's on-screen height so the box doesn't collapse.
          style={{ height: `${sheetHeightPx * scale * shownPages.length}px` }}
        >
          <div
            style={{
              width: `${sheetWidthPx}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              // A sheet narrower than the screen is centred; a scaled one is already full width.
              marginInline: scale === 1 ? "auto" : undefined,
            }}
          >
            <LabelSheet items={shownItems} geometry={geometry} />
          </div>
        </div>
      </div>

      {isTruncated && (
        <p className="text-label text-ink-muted">{t("truncated", { shown: shownPages.length, total: pages.length })}</p>
      )}
    </div>
  );
}

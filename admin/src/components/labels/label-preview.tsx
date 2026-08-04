"use client";

import { useTranslations } from "next-intl";
import { LABEL_PREVIEW_MAX_PAGES } from "@/constants/labels";
import { mmToPx, paginateLabels, printedPageSizeMm } from "@/lib/labels";
import { useFitScale } from "@/hooks/use-fit-scale";
import { LabelSheet } from "@/components/labels/label-sheet";
import type { LabelGeometry, LabelPrintItem } from "@/types/label";

// What will come out of the printer, at the size it will come out — the same
// <LabelSheet> the print portal renders, shrunk to fit the screen.
//
// Only the wrapper is scaled, and only on screen: the printed copy lives in
// its own portal and is never transformed. The viewport is forced LTR
// because it frames a photo of a page, not text (see LabelSheet).
export function LabelPreview({ items, geometry }: { items: readonly LabelPrintItem[]; geometry: LabelGeometry }) {
  const t = useTranslations("labels.preview");
  const { widthMm, heightMm } = printedPageSizeMm(geometry);
  const sheetWidthPx = mmToPx(widthMm);
  const sheetHeightPx = mmToPx(heightMm);
  const { ref, scale } = useFitScale(sheetWidthPx);

  const pages = paginateLabels(items, geometry);
  // Long runs are shown up to a point: the twentieth identical page teaches
  // nobody anything, and it makes the screen crawl on a phone. Everything
  // still prints — only the preview stops early.
  const shownPages = pages.slice(0, LABEL_PREVIEW_MAX_PAGES);
  const shownItems = shownPages.flat();
  const isTruncated = shownPages.length < pages.length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t("pageCount", { count: pages.length })}</p>

      <div ref={ref} dir="ltr" className="label-preview overflow-hidden rounded-xl border border-border bg-muted p-3">
        <div
          // Reserves the on-screen height the scaled sheet actually occupies,
          // so the card doesn't collapse under the transformed content.
          style={{ height: `${sheetHeightPx * scale * shownPages.length}px` }}
        >
          <div
            style={{
              width: `${sheetWidthPx}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              // A sheet narrower than the screen (a small thermal label on a
              // desktop) is centred; a scaled-down one is already as wide as
              // the box and stays flush with its start edge.
              marginInline: scale === 1 ? "auto" : undefined,
            }}
          >
            <LabelSheet items={shownItems} geometry={geometry} />
          </div>
        </div>
      </div>

      {isTruncated && (
        <p className="text-sm text-muted-foreground">
          {t("truncated", { shown: shownPages.length, total: pages.length })}
        </p>
      )}
    </div>
  );
}

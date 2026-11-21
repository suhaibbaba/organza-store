import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@store/shared/constants/pagination";
import { QUANTITY_MAX } from "@store/shared/constants/quantity";
import type { LabelListFilters } from "@/types/label";
import { PRODUCT_PRINT_STATES } from "@store/shared/constants/product";
import { urlParam } from "@/lib/url-filters";
import type { UrlParams } from "@/types/urlFilters";

export const LABEL_SEARCH_DEBOUNCE_MS = 250;

export const PREVIEW_DEBOUNCE_MS = 250;

export const LABEL_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

// After a bulk import, "not printed yet" is the whole job.
export const DEFAULT_LABEL_FILTERS: LabelListFilters = {
  q: "",
  categoryId: null,
  printState: "not_printed",
  page: DEFAULT_PAGE,
};

// A4 sheet, in millimetres — the paper the grid mode lays labels out on.
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export const MM_PER_INCH = 25.4;
export const CSS_PX_PER_INCH = 96;

// The same ceiling as every quantity box (shared/constants/quantity.ts); the run total is the real cap.
export const LABEL_COPIES_MAX = QUANTITY_MAX;

// Past this the print preview is slow enough to look broken on a phone.
export const LABEL_RUN_MAX = 500;

// Only the preview is capped; every label still prints.
export const LABEL_PREVIEW_MAX_PAGES = 12;

// Below this EAN-13 bars get too thin to scan reliably; only ever a warning.
export const MIN_SCANNABLE_LABEL_WIDTH_MM = 30;

// Prints only while <body> carries the class, so Ctrl+P elsewhere prints that screen; used by globals.css.
export const LABEL_PRINT_ROOT_ID = "label-print-root";
export const LABEL_PRINTING_BODY_CLASS = "is-printing-labels";

// Drawing units; the SVG is scaled by its viewBox, so these only set proportions.
export const BARCODE_OPTIONS = {
  barWidth: 2,
  barHeight: 60,
  fontSize: 16,
  textMargin: 2,
  // Quiet zones: a barcode flush to the sticker's edge will not scan.
  margin: 6,
} as const;

export const LABEL_LIST_URL_PARAMS: UrlParams<LabelListFilters> = {
  q: urlParam.text(),
  categoryId: urlParam.id(),
  printState: urlParam.oneOf(PRODUCT_PRINT_STATES),
  page: urlParam.page(),
};

import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@shared/constants/pagination";
import type { LabelListFilters } from "@/types/label";

export const LABEL_SEARCH_DEBOUNCE_MS = 400;

// The preview redraws the whole sheet, so it trails the copies inputs by a
// moment instead of redrawing on every keystroke.
export const PREVIEW_DEBOUNCE_MS = 250;

export const LABEL_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

// Opens on "not printed yet": after a bulk import that is the whole job, and
// it is the one list a user needs to see without touching a filter.
export const DEFAULT_LABEL_FILTERS: LabelListFilters = {
  q: "",
  categoryId: null,
  printState: "not_printed",
  page: DEFAULT_PAGE,
};

// A4 sheet, in millimetres — the paper the grid mode lays labels out on.
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

// CSS treats 1in as exactly 96px, which is how a mm-sized preview is scaled
// to fit a phone screen.
export const MM_PER_INCH = 25.4;
export const CSS_PX_PER_INCH = 96;

// Per design. Generous enough for a genuinely deep line, tight enough that a
// stray extra digit can't eat a whole roll — the run total below is the real
// ceiling anyway.
export const LABEL_COPIES_MAX = 999;

// Ceiling for a whole print run. Past this the browser's print preview gets
// slow enough to look broken on a phone, so we ask for a smaller batch
// instead of letting it hang.
export const LABEL_RUN_MAX = 500;

// The preview stops after this many pages — a 300-label roll is a very long
// scroll, and the tenth identical page teaches nobody anything. Only the
// preview is capped; every label still prints.
export const LABEL_PREVIEW_MAX_PAGES = 12;

// EAN-13 is 95 modules plus quiet zones; below roughly this width the bars
// get too thin for a phone camera or a cheap scanner to read reliably. Only
// ever a warning — the shop knows its own printer.
export const MIN_SCANNABLE_LABEL_WIDTH_MM = 30;

// The printed sheet is portalled to <body> under this id, and only prints
// while the body carries the class below (so Ctrl+P on any other screen
// still prints that screen normally). Both are referenced from the print
// rules in app/globals.css.
export const LABEL_PRINT_ROOT_ID = "label-print-root";
export const LABEL_PRINTING_BODY_CLASS = "is-printing-labels";

// JsBarcode geometry. These are the barcode's own drawing units — the SVG is
// then scaled to the label by its viewBox — so they only set the bar/height
// ratio and the size of the digits printed underneath.
export const BARCODE_OPTIONS = {
  barWidth: 2,
  barHeight: 60,
  fontSize: 16,
  textMargin: 2,
  // Quiet zones on both sides; a barcode printed flush to the edge of a
  // sticker will not scan.
  margin: 6,
} as const;

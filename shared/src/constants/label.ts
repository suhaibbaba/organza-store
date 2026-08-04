// Barcode-label printing (CLAUDE.md rule 13: every product and variant
// carries a generated EAN-13). The shop buys whatever label printer it can
// get, so nothing about the sheet is hard-coded — the numbers below are only
// the initial values of the Setting singleton (CLAUDE.md rule 14), and the
// Prisma defaults in backend/prisma/schema.prisma mirror them exactly.

// THERMAL — one label per page, the page IS the label (roll printers).
// A4_GRID — a grid of labels on an ordinary sheet of sticker paper.
export const LABEL_PRINT_MODES = ["THERMAL", "A4_GRID"] as const;

// Millimetres everywhere: it is what label stock is sold in, and what a
// print stylesheet needs.
export const LABEL_DEFAULTS = {
  printMode: "THERMAL",
  widthMm: 50,
  heightMm: 30,
  columns: 3,
  rows: 8,
  pageMarginTopMm: 10,
  pageMarginRightMm: 8,
  pageMarginBottomMm: 10,
  pageMarginLeftMm: 8,
  gapXMm: 3,
  gapYMm: 3,
} as const;

// Sanity bounds, not opinions about paper: they exist so a typo can't ask
// for a 50-metre label or a grid of ten thousand cells.
export const LABEL_LIMITS = {
  minDimensionMm: 1,
  maxDimensionMm: 1000,
  maxMarginMm: 200,
  maxGapMm: 200,
  minGridCount: 1,
  maxGridCount: 50,
} as const;

// How many products one "mark as printed" call may cover — a printing run is
// a batch of labels, not the whole catalogue (CLAUDE.md rule 15: never
// unbounded).
export const MAX_LABEL_PRINT_BATCH = 200;

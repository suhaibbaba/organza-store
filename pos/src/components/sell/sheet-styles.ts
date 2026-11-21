// Counter-side touch targets inside the POS sheets: @store/ui's controls are desk-sized (36px), a hurried tap needs 48px.
export const SHEET_ACTION = "h-12 min-h-12 px-5 text-base [&_svg]:size-5";

export const SHEET_ACTION_TALL = "h-14 min-h-14 px-5 text-base [&_svg]:size-5";

// SegmentedControl only ships md/sm; this lifts its segments and thumb to the old "lg" size.
export const SHEET_SEGMENTED =
  "[&_[data-part=segment]]:h-11 [&_[data-part=segment]]:min-w-20 [&_[data-part=segment]]:text-base [&_[data-part=segment-thumb]]:h-11";

// A gift is drawn in violet so it never looks like the (green) sale it sits next to.
export const GIFT_BUTTON = "bg-tint-3-ink text-ink-inverse hover:bg-tint-3-ink/90 active:bg-tint-3-ink/80";

// Shared page-layout primitives (components/layout).

// How a stat card's figure is coloured. `success` is money the shop is
// holding; `warning` is money somebody else is holding — the figure to chase,
// which must never read as takings. Never colour alone: the label says which
// is which, the tone only reinforces it.
export type StatCardTone = "default" | "warning" | "success";

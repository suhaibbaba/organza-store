type ScaleStop = "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";

type Scale<Family extends string> = `${Family}-${ScaleStop}`;

export type PaletteToken =
  Scale<"primary"> | Scale<"success"> | Scale<"danger"> | Scale<"warning"> | Scale<"neutral">;

export type SurfaceToken =
  | "surface"
  | "canvas"
  | "inset"
  | "sunken"
  | "row-hover"
  | "table-head"
  | "quiet-bg"
  | "quiet-ink"
  | "rail"
  | "selected"
  | "selected-line"
  | "ink"
  | "ink-muted"
  | "ink-subtle"
  | "ink-faint"
  | "ink-inverse"
  | "line"
  | "line-strong"
  | "tag-from"
  | "tag-to";

export type TintToken = `tint-${1 | 2 | 3 | 4 | 5 | 6}-${"bg" | "ink"}`;

export type ColorToken = PaletteToken | SurfaceToken | TintToken;

export type RadiusToken =
  "card" | "panel" | "brand" | "field" | "nav" | "control" | "chip" | "pill";

export type ShadowToken =
  | "card"
  | "card-hover"
  | "nav-active"
  | "float"
  | "glass"
  | "drawer"
  | "now"
  | "pill"
  | "ring"
  | "field-focus"
  | "field-error"
  | "field-error-ring";

export type TextToken =
  "micro" | "meta" | "label" | "value" | "nav" | "section" | "title" | "display" | "kpi" | "field";

export type ControlToken = "h" | "h-sm";

export type AnimationToken =
  "menu-in" | "menu-out" | "fade-in" | "fade-out" | "drawer-in" | "drawer-out";

// The selling screen's control vocabulary, written once so every button on
// it agrees (the tokens behind these names live in app/globals.css).

// Every button and the search field: 44px tall, the touch floor. Small round
// and square buttons drawn under 44px pair theirs with `hit-area`.
export const CONTROL_HEIGHT = "h-11";
export const CONTROL_SIZE = "size-11";

// The cart: a white panel with 20px corners, a hairline border and the
// medium lift — the one surface on the screen that should read as raised.
export const SCREEN_PANEL = "rounded-panel border border-border bg-card shadow-md";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// The important action: emerald, white words, darker on hover, darker still
// pressed.
export const PRIMARY_ACTION = [
  "rounded-control bg-primary text-sm font-semibold text-primary-foreground",
  "transition-[background-color,box-shadow] not-disabled:hover:bg-primary-hover not-disabled:active:bg-primary-active",
  "disabled:cursor-not-allowed disabled:opacity-50",
  FOCUS,
].join(" ");

// Everything beside it: white, a light border, dark words, a soft fill on
// hover — quieter on purpose.
export const SECONDARY_ACTION = [
  "rounded-control border border-border bg-card text-sm font-medium text-foreground",
  "transition-[background-color,border-color] not-disabled:hover:border-border-strong not-disabled:hover:bg-soft",
  "disabled:cursor-not-allowed disabled:opacity-50",
  FOCUS,
].join(" ");

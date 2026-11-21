// Layout values the CSS and the components have to agree on.
//
// The safe-area insets and the bar geometry live in globals.css (see the
// "Fixed chrome" block there); only the names of the properties that JS
// writes to belong here.

/** CSS custom property the checkout bar publishes its measured height on. */
export const CHECKOUT_BAR_HEIGHT_VAR = "--checkout-bar-height";

/**
 * The selling screen's widths, as media queries for the few things CSS cannot
 * switch on its own (an input's placeholder, closing the cart sheet once the
 * side panel exists). Must match the `--breakpoint-*` values in globals.css.
 */
export const TAB_MEDIA_QUERY = "(min-width: 37.5rem)";
export const DESK_MEDIA_QUERY = "(min-width: 62.5rem)";

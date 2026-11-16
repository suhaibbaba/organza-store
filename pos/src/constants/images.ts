/**
 * Drawn wherever a product has no photo, or the photo it has won't load
 * (public/product-placeholder.svg).
 *
 * One flat file at one URL, served straight out of public/ rather than
 * through the image optimizer: the browser and the service worker both cache
 * it by URL, so a screenful of photoless products fetches it once. It is also
 * what the POS falls back to instead of ever showing the browser's own
 * broken-image glyph — a cashier reading a torn label does not need the app
 * telling them the picture is broken too.
 */
export const PRODUCT_PLACEHOLDER_PATH = "/product-placeholder.svg";

// ---------------------------------------------------------------------------
// What each thumbnail tells next/image about the box it fills (`sizes`)
// ---------------------------------------------------------------------------
// next/image fetches the smallest copy at least `sizes` × the screen's
// density, so these are the boxes' own widths — in pixels, never in `vw`: a
// `vw` anywhere in `sizes` makes next/image drop every copy narrower than a
// fraction of 640px from the srcset, which is how a 109px card on the shop's
// iPhone came to fetch a 384px picture. Change one with its box.

/** The search result row's photo: size-16. */
export const SEARCH_RESULT_THUMB_SIZES = "64px";

/** A cart line's photo: size-14. */
export const CART_LINE_THUMB_SIZES = "56px";

/**
 * A product browser card's square photo. The grid sizes its columns from the
 * panel, and a column settles between about 6.8rem on a 375px phone and 12rem
 * on a wide screen.
 */
export const BROWSER_CARD_THUMB_SIZES = "(min-width: 640px) 192px, 128px";

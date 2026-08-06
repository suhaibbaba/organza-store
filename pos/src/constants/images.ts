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

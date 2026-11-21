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

/**
 * A product card's square photo on the selling screen's grid: about 170px wide
 * two-up on a phone, up to about 230px three-up on a tablet, and 180-200px
 * in the four- and five-column layouts beside the cart panel.
 */
export const SELL_CARD_THUMB_SIZES = "(min-width: 600px) 240px, 180px";

/** A cart line's photo in the selling screen's cart panel: size-13. */
export const SELL_CART_THUMB_SIZES = "52px";

/** The product's photo beside the variant picker's title: size-16. */
export const VARIANT_PICKER_PHOTO_SIZES = "64px";

/** A variant's own photo on its tile in the picker: size-14. */
export const VARIANT_TILE_THUMB_SIZES = "56px";

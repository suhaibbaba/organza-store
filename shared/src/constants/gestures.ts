// Touch behaviour that has to be identical in the admin and the POS, because
// the same person uses both on the same phone within the same minute
// (CLAUDE.md "Frontend UX"). The rules themselves are in each app's
// globals.css; the two names below are the ones JavaScript also has to know,
// so they are declared once rather than typed out in four files.

/**
 * Opt back IN to selecting and copying: `data-selectable="true"`.
 *
 * The app switches text selection OFF wherever it would only get in the way —
 * a long press on a product card, a cart line or a button pops up iOS's
 * "Copy / Look Up / Share" sheet, which covers the interface mid-sale and
 * means nothing here. But a barcode, an order number and a phone number are
 * exactly the things somebody DOES need to lift out and paste somewhere, so
 * they carry this attribute and behave like ordinary text again.
 */
export const SELECTABLE_ATTRIBUTE = "data-selectable";

/**
 * Opt OUT of the app's zoom guards for one subtree: `data-allow-zoom="true"`.
 *
 * The guards below cancel every pinch, everywhere — which is right for a till
 * and wrong for the photo editor, where pinching to zoom into a garment is
 * the whole point. Anything that handles its own two-finger gestures says so
 * with this, and the document-level listeners leave it alone.
 */
export const ALLOW_ZOOM_ATTRIBUTE = "data-allow-zoom";

/**
 * How far up the tree to look for the opt-out above before giving up.
 *
 * Bounded because this runs on every touchmove of a two-finger gesture, which
 * on a phone is a great many times a second. Ten levels is far more than any
 * of these components nest; walking to <html> instead would put an unbounded
 * loop in the hottest path in the app.
 */
export const GESTURE_OPT_OUT_SEARCH_DEPTH = 10;

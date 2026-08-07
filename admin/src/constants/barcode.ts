/* ---------------------------------------------------------------------------
 * Filling a barcode field from a scanner
 *
 * Two devices, one field. On the counter's laptop it is the plug-in wedge
 * scanner: a keyboard that types the code very fast and presses Enter. On a
 * phone — which is ~95% of how this admin is used — it is the camera.
 *
 * The wedge's characters cannot be taken from `event.key`, because the shop's
 * keyboard layout is Arabic all day and `event.key` reports ٥ for the 5 key
 * and ش for A. They are read off the key's physical position instead, exactly
 * as the POS reads a scan off the whole screen (@shared/constants/keyboard).
 * ------------------------------------------------------------------------ */

// What a scanner presses when it has finished sending the code. Enter only:
// Tab is left alone so it still moves to the next field, which is what both a
// person and a Tab-configured scanner expect.
export const BARCODE_TERMINATOR_CODES: readonly string[] = ["Enter", "NumpadEnter"];

// ---- camera (html5-qrcode, the same engine and settings as the POS) -------

// Only what falls inside this box is decoded; derived from the live viewfinder
// rather than fixed, because phone camera feeds vary wildly in size.
export const SCANNER_BOX_WIDTH_RATIO = 0.92;
export const SCANNER_BOX_HEIGHT_RATIO = 0.5;
export const SCANNER_FPS = 10;

// html5-qrcode injects its <video> into the element with this id.
export const SCANNER_ELEMENT_ID = "admin-barcode-scanner";

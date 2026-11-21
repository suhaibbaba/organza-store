// A wedge scanner types under an Arabic layout, so its keys are read by physical position, not event.key.

// Enter only: Tab still moves to the next field.
export const BARCODE_TERMINATOR_CODES: readonly string[] = ["Enter", "NumpadEnter"];

// ---- camera (html5-qrcode, the same engine and settings as the POS) -------

// Derived from the live viewfinder, because camera feeds vary wildly in size.
export const SCANNER_BOX_WIDTH_RATIO = 0.92;
export const SCANNER_BOX_HEIGHT_RATIO = 0.5;
export const SCANNER_FPS = 10;

// html5-qrcode injects its <video> into the element with this id.
export const SCANNER_ELEMENT_ID = "admin-barcode-scanner";

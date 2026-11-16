"use client";

import { useEffect } from "react";
import { installZoomGuards } from "@organza/shared/lib/nativeGestures";

/**
 * The half of "this app does not zoom" that only JavaScript can do.
 *
 * The viewport meta (see the layout above this) is honoured by Chrome and by
 * the Android WebView, and ignored by iOS — deliberately, since iOS 10, on
 * accessibility grounds. Safari answers a pinch with its own `gesture*`
 * events instead, and cancelling those is the only thing that stops the page
 * scaling under somebody's fingers. `installZoomGuards` (shared, so the POS
 * and the admin behave identically) also cancels any touchmove carrying more
 * than one finger, which is the same gesture arriving by the standard route.
 *
 * Renders nothing. It is here for its effect, and it is mounted at the app
 * shell rather than per screen so a page added next year inherits it without
 * anybody remembering to.
 *
 * Anything that genuinely wants two fingers — the product photo editor, where
 * pinching to zoom into a garment IS the feature — marks its own subtree with
 * data-allow-zoom="true" and is left alone.
 */
export function NativeGestureGuard() {
  useEffect(() => installZoomGuards(document), []);
  return null;
}

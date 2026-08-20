import {
  ALLOW_ZOOM_ATTRIBUTE,
  GESTURE_OPT_OUT_SEARCH_DEPTH,
  SELECTABLE_ATTRIBUTE,
} from "../constants/gestures";

/**
 * STOP THE PAGE ZOOMING. All of it, everywhere, in both apps.
 *
 * These two apps run on a shop counter — a phone in one hand and a garment in
 * the other. A pinch nobody meant to make leaves the screen sitting at 1.4×
 * and skewed halfway through a sale, and the cashier has a customer waiting;
 * they are not going to stop and pinch it back. An installed app that can end
 * up in that state does not feel like an app, it feels like a web page.
 *
 * Three things have to agree before zooming is genuinely gone, and this is
 * only the third:
 *
 *   1. The viewport meta says `maximum-scale=1, user-scalable=no`. Chrome and
 *      the Android WebView honour it, which covers the counter's touchscreen.
 *   2. `touch-action: manipulation` in CSS drops the double-tap-to-zoom
 *      gesture (and with it the 300ms click delay) while leaving ordinary
 *      panning and scrolling exactly as they were. Notably it does NOT block
 *      taps or fast repeated taps: the rapid scan → quantity → discount →
 *      checkout run through a sale behaves as before.
 *   3. This file, because iOS has deliberately ignored `user-scalable=no`
 *      since iOS 10 on accessibility grounds. Safari's answer to a pinch is a
 *      pair of non-standard `gesture*` events, and cancelling those is the
 *      only thing that stops it.
 *
 * Standalone versus Safari, honestly: in the INSTALLED app (added to the home
 * screen, `display: standalone`) this holds — there is no browser chrome, no
 * zoom control in a toolbar, and the cancelled gesture events leave the page
 * at 1×. In plain Safari with the app open as a tab, the same listeners stop
 * the pinch, but Safari still offers "Zoom" from the page-settings menu in
 * the address bar and can restore a remembered zoom for the site; nothing a
 * page can do reaches those. The counter runs the installed app, which is
 * where this is airtight.
 *
 * What is deliberately NOT done here:
 *
 *   - `touchend` is never cancelled. The obvious way to kill double-tap zoom
 *     is to swallow the second tap inside 300ms — and that is exactly the
 *     gesture of tapping "+" twice quickly on a quantity, which would then
 *     silently do nothing. `touch-action: manipulation` achieves the same end
 *     without touching taps at all.
 *   - Ctrl+wheel (a trackpad pinch, or ⌘/Ctrl and +) is left alone. That is
 *     the browser's own zoom on a desktop, asked for deliberately by somebody
 *     who wants the whole interface bigger — and on the counter's mouse-driven
 *     screen it is the accessibility valve that replaces the pinch we removed.
 */

/**
 * The handful of DOM shapes this file touches, described structurally.
 *
 * shared/ is compiled without the DOM library — the backend consumes this
 * same package and has no `Document` — so naming those types would put
 * declarations in dist/ that the API cannot compile against. Everything below
 * is what `document` and a touch event actually provide, and nothing else,
 * so the apps pass the real objects and TypeScript is satisfied at both ends.
 */
interface ElementLike {
  getAttribute(name: string): string | null;
  readonly parentElement: ElementLike | null;
}

interface GuardedEvent {
  readonly target: unknown;
  readonly cancelable?: boolean;
  preventDefault(): void;
}

interface GuardedTouchEvent extends GuardedEvent {
  readonly touches: { readonly length: number };
}

// `any` for the event, deliberately: this has to accept the REAL `document`,
// whose own overloads are typed with the DOM's `Event` — a type this package
// cannot name. Narrowing it to `unknown` or `never` here makes `document`
// itself unassignable and the guard uncallable. Each listener below states
// the shape it actually reads, so nothing downstream of this line is loose.
interface GestureEventTarget {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: string, listener: (event: any) => void, options?: { passive?: boolean }): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeEventListener(type: string, listener: (event: any) => void): void;
}

function asElement(target: unknown): ElementLike | null {
  const candidate = target as ElementLike | null;
  return candidate && typeof candidate.getAttribute === "function" ? candidate : null;
}

function allowsZoom(target: unknown): boolean {
  let node = asElement(target);
  for (let depth = 0; node && depth < GESTURE_OPT_OUT_SEARCH_DEPTH; depth += 1) {
    if (node.getAttribute(ALLOW_ZOOM_ATTRIBUTE) === "true") return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * Installs the guards on the document; returns the function that removes them
 * again (so a React effect can simply hand it back).
 *
 * Non-passive listeners, which is the whole point: a passive listener is one
 * that has promised not to call `preventDefault()`, and the browser ignores
 * it if it does. Chrome treats `touchmove` on the document as passive by
 * default, so `{ passive: false }` is not decoration here.
 */
export function installZoomGuards(doc: GestureEventTarget): () => void {
  const cancel = (event: GuardedEvent) => {
    if (allowsZoom(event.target)) return;
    event.preventDefault();
  };

  const cancelMultiTouch = (event: GuardedTouchEvent) => {
    // One finger is a scroll, a tap or a drag — every one of which the app
    // still needs. Two or more is a pinch, and nothing in either app does
    // anything with two fingers except the photo editor, which opts out.
    if (event.touches.length < 2) return;
    if (allowsZoom(event.target)) return;
    if (event.cancelable !== false) event.preventDefault();
  };

  // Safari's pinch, in three parts. `gesturestart` alone is enough on paper;
  // the other two are cancelled as well because a gesture that begins on an
  // opted-out subtree and travels out of it would otherwise arrive here
  // mid-flight with nothing watching for it.
  const listeners: [string, (event: GuardedTouchEvent) => void][] = [
    ["gesturestart", cancel],
    ["gesturechange", cancel],
    ["gestureend", cancel],
    ["touchmove", cancelMultiTouch],
  ];

  for (const [type, listener] of listeners) doc.addEventListener(type, listener, { passive: false });

  return () => {
    for (const [type, listener] of listeners) doc.removeEventListener(type, listener);
  };
}

/**
 * Spread onto anything whose text somebody may genuinely want to lift out —
 * a barcode, an order number, a customer's phone number, the build id on a
 * failure screen:
 *
 *     <dd {...SELECTABLE}>{product.barcode}</dd>
 *
 * Selection and the long-press callout are off across the app (see the "An
 * app, not a page in a browser" block in each globals.css), because holding a
 * finger on a product card mid-sale should not raise iOS's Copy/Share sheet.
 * This is how the handful of places that are text rather than interface say
 * so, in both apps, with the attribute name written once.
 */
export const SELECTABLE = { [SELECTABLE_ATTRIBUTE]: "true" } as const;

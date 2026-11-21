import { ALLOW_ZOOM_ATTRIBUTE, GESTURE_OPT_OUT_SEARCH_DEPTH, SELECTABLE_ATTRIBUTE } from "../constants/gestures";

/** Stops page zoom on iOS, which ignores user-scalable=no: cancel two-finger touchmove and Safari's gesture events; never touchend or Ctrl+wheel. */

/** DOM shapes described structurally: shared/ compiles without the DOM lib because the backend uses it too. */
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

// `any` so the real `document` is assignable; each listener states the shape it reads.
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
    if (node.getAttribute(ALLOW_ZOOM_ATTRIBUTE) === "true") {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** Installs the guards and returns their remover; non-passive, or preventDefault is ignored. */
export function installZoomGuards(doc: GestureEventTarget): () => void {
  const cancel = (event: GuardedEvent) => {
    if (allowsZoom(event.target)) {
      return;
    }
    event.preventDefault();
  };

  const cancelMultiTouch = (event: GuardedTouchEvent) => {
    // Two or more fingers is a pinch; only the photo editor uses two fingers, and it opts out.
    if (event.touches.length < 2) {
      return;
    }
    if (allowsZoom(event.target)) {
      return;
    }
    if (event.cancelable !== false) {
      event.preventDefault();
    }
  };

  // All three gesture events are cancelled, for gestures that start inside an opted-out subtree and leave it.
  const listeners: [string, (event: GuardedTouchEvent) => void][] = [
    ["gesturestart", cancel],
    ["gesturechange", cancel],
    ["gestureend", cancel],
    ["touchmove", cancelMultiTouch],
  ];

  for (const [type, listener] of listeners) {
    doc.addEventListener(type, listener, { passive: false });
  }

  return () => {
    for (const [type, listener] of listeners) {
      doc.removeEventListener(type, listener);
    }
  };
}

/** Spread on text people may need to copy (barcode, order number, phone): selection and the callout are off app-wide. */
export const SELECTABLE = { [SELECTABLE_ATTRIBUTE]: "true" } as const;

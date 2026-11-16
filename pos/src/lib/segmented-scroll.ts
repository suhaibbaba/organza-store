"use client";

import { useEffect, useRef } from "react";
import { SEGMENT_SCROLL_PADDING_PX } from "@/constants/segmented";

// What "the chosen one" looks like in the DOM for both kinds of tab row we
// have: Radix's tabs mark it with data-state, our own button rows with
// aria-pressed. One selector so a row can't be left out by being built the
// other way.
const ACTIVE_SEGMENT_SELECTOR = '[data-state="active"], [aria-pressed="true"]';

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollActiveSegmentIntoView(row: HTMLElement) {
  // A row whose segments all fit is not a scroll container in practice, and
  // must never be nudged.
  if (row.scrollWidth <= row.clientWidth) return;
  const active = row.querySelector<HTMLElement>(ACTIVE_SEGMENT_SELECTOR);
  if (!active) return;

  const rowBox = row.getBoundingClientRect();
  const activeBox = active.getBoundingClientRect();
  const beforeStart = activeBox.left - rowBox.left - SEGMENT_SCROLL_PADDING_PX;
  const pastEnd = activeBox.right - rowBox.right + SEGMENT_SCROLL_PADDING_PX;
  const delta = beforeStart < 0 ? beforeStart : pastEnd > 0 ? pastEnd : 0;
  if (delta === 0) return;

  // Measured and moved in physical pixels along the x axis — which is what
  // scrollBy takes whichever way the page runs, so this needs to know nothing
  // about Arabic or the browser's idea of scrollLeft in RTL.
  row.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/**
 * Keeps the chosen segment of a tab row in view.
 *
 * A row of tabs is sized to its labels and scrolls sideways when a phone is
 * too narrow for them (never wrapping onto a second line), which leaves the
 * chosen one able to sit off screen — after a filter is restored from the
 * URL, or after a tab is picked with the keyboard. This scrolls it back,
 * and only ever when the row actually overflows.
 *
 * The active segment is watched rather than passed in, so a Radix tab list
 * (which knows its state only through data-state on the DOM node) and our own
 * aria-pressed button rows share one behaviour.
 */
export function useActiveSegmentInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const row = ref.current;
    if (!row) return;

    const check = () => scrollActiveSegmentIntoView(row);
    check();
    // Again once the Arabic font has actually loaded and once the phone is
    // turned: both change how wide the labels are, and so whether the row
    // overflows at all.
    void document.fonts?.ready.then(check);
    window.addEventListener("resize", check);

    const observer = new MutationObserver(check);
    observer.observe(row, {
      attributes: true,
      attributeFilter: ["data-state", "aria-pressed"],
      subtree: true,
    });
    return () => {
      window.removeEventListener("resize", check);
      observer.disconnect();
    };
  }, []);

  return ref;
}

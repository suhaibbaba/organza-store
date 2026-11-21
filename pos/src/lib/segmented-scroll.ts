"use client";

import { useEffect, useRef } from "react";
import { SEGMENT_SCROLL_PADDING_PX } from "@/constants/segmented";

// Radix tabs mark the chosen one with data-state, our button rows with aria-pressed.
const ACTIVE_SEGMENT_SELECTOR = '[data-state="active"], [aria-pressed="true"]';

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollActiveSegmentIntoView(row: HTMLElement) {
  if (row.scrollWidth <= row.clientWidth) {
    return;
  }
  const active = row.querySelector<HTMLElement>(ACTIVE_SEGMENT_SELECTOR);
  if (!active) {
    return;
  }

  const rowBox = row.getBoundingClientRect();
  const activeBox = active.getBoundingClientRect();
  const beforeStart = activeBox.left - rowBox.left - SEGMENT_SCROLL_PADDING_PX;
  const pastEnd = activeBox.right - rowBox.right + SEGMENT_SCROLL_PADDING_PX;
  const delta = beforeStart < 0 ? beforeStart : pastEnd > 0 ? pastEnd : 0;
  if (delta === 0) {
    return;
  }

  // scrollBy takes physical pixels either direction, so this needs nothing RTL-specific.
  row.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

// Tab rows scroll sideways on narrow phones, so the chosen segment is scrolled into view.
export function useActiveSegmentInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const row = ref.current;
    if (!row) {
      return;
    }

    const check = () => scrollActiveSegmentIntoView(row);
    check();
    // Re-checked once the Arabic font loads and on rotation: both change label widths.
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

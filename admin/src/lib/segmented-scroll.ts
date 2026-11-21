"use client";

import { useEffect, useRef } from "react";
import { SEGMENT_SCROLL_PADDING_PX } from "@/constants/segmented";

// Radix tabs use data-state, our button rows aria-pressed.
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

  // Physical x pixels, so RTL needs no special case.
  row.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

// Scrolls the chosen tab back into view when the row overflows; watched in the DOM so Radix and button rows share it.
export function useActiveSegmentInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const row = ref.current;
    if (!row) {
      return;
    }

    const check = () => scrollActiveSegmentIntoView(row);
    check();
    // Font load and rotation both change the labels' width.
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

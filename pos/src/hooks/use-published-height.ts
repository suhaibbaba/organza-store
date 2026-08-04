"use client";

import { useEffect, useRef } from "react";

// Publishes an element's rendered height on a CSS custom property at the
// document root, so the scrolling content of the page can reserve exactly
// that much space underneath itself.
//
// This is for bars that are pinned to the edge of the screen and taken out of
// the flow: the page has no idea how tall they are, and a hard-coded guess
// either traps the last row under the bar or leaves a hole below it. The
// measurement is the border box, so any padding the bar adds for the iOS home
// indicator is already counted.
export function usePublishedHeight<T extends HTMLElement>(property: string) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty(property, `${element.offsetHeight}px`);
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      // Back to the fallback in globals.css: the bar is gone, and a height
      // left behind would hold open a gap under whatever replaces it.
      root.style.removeProperty(property);
    };
  }, [property]);

  return ref;
}

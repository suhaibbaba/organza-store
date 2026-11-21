"use client";

import { useEffect, useRef } from "react";

// Publishes a pinned bar's height on a root CSS variable so the scrolling content can reserve that space.
export function usePublishedHeight<T extends HTMLElement>(property: string) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty(property, `${element.offsetHeight}px`);
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      // Back to the globals.css fallback, or a stale height would hold a gap open.
      root.style.removeProperty(property);
    };
  }, [property]);

  return ref;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Scales a fixed-width block (a sheet of paper measured in millimetres) down
// to whatever width the screen actually has — the preview has to be legible
// on a phone without ever scrolling sideways. Never scales up: a 50mm label
// blown up to fill a desktop column would be a lie about what prints.
export function useFitScale(contentWidthPx: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element || contentWidthPx <= 0) return;
    setScale(Math.min(1, element.clientWidth / contentWidthPx));
  }, [contentWidthPx]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // observe() delivers a first measurement of its own, so there is no need
    // to measure synchronously here as well.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  return { ref, scale };
}

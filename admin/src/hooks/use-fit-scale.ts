"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Scales a mm-sized sheet down to the screen, never up: a blown-up label would misstate what prints.
export function useFitScale(contentWidthPx: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element || contentWidthPx <= 0) {
      return;
    }
    setScale(Math.min(1, element.clientWidth / contentWidthPx));
  }, [contentWidthPx]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  return { ref, scale };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCAN_FLASH_MS } from "@/constants/pos";
import type { FeedbackVariant, ScanFlash } from "@/types/feedback";

export interface ScanFlashState {
  // Which cart line is lit right now, if any.
  lineKey: string | null;
  flash: ScanFlash | null;
  // Separate because the frame also flashes for a code that matched nothing.
  pulse: ScanFlash | null;
  markScanned: (lineKey: string) => void;
  markFailed: () => void;
}

// The cart is the only proof a scan worked, so the grown line lights up and the frame flashes.
export function useScanFlash(): ScanFlashState {
  const [lineKey, setLineKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<ScanFlash | null>(null);
  const [pulse, setPulse] = useState<ScanFlash | null>(null);
  // Bumped on every read so re-scanning the same line restarts the animation.
  const token = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback((variant: FeedbackVariant, key: string | null) => {
    token.current += 1;
    const next = { token: token.current, variant };
    setPulse(next);
    setLineKey(key);
    setFlash(key ? next : null);

    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      setLineKey(null);
      setFlash(null);
      setPulse(null);
    }, SCAN_FLASH_MS);
  }, []);

  const markScanned = useCallback((key: string) => bump("success", key), [bump]);
  const markFailed = useCallback(() => bump("destructive", null), [bump]);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return { lineKey, flash, pulse, markScanned, markFailed };
}

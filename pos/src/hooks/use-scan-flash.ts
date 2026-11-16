"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCAN_FLASH_MS } from "@/constants/pos";
import type { FeedbackVariant, ScanFlash } from "@/types/feedback";

export interface ScanFlashState {
  // Which cart line is lit right now, if any.
  lineKey: string | null;
  flash: ScanFlash | null;
  // Same read, reported on the viewfinder — kept separate because the frame
  // also flashes for a code that matched nothing, which belongs to no line.
  pulse: ScanFlash | null;
  markScanned: (lineKey: string) => void;
  markFailed: () => void;
}

// The seen-it-register part of scanning: the line that just grew lights up
// and runs a little bar down over the repeat-scan window, and the
// viewfinder's frame flashes in the same colour.
//
// It exists because the cart is the only proof a scan worked, and the cart
// is exactly what the camera sheet is covering. Something has to
// acknowledge the read where the cashier is already looking.
export function useScanFlash(): ScanFlashState {
  const [lineKey, setLineKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<ScanFlash | null>(null);
  const [pulse, setPulse] = useState<ScanFlash | null>(null);
  // Bumped on every read so that re-scanning the SAME line restarts the
  // animation instead of leaving the finished one on screen.
  const token = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback((variant: FeedbackVariant, key: string | null) => {
    token.current += 1;
    const next = { token: token.current, variant };
    setPulse(next);
    setLineKey(key);
    setFlash(key ? next : null);

    if (timer.current) clearTimeout(timer.current);
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
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { lineKey, flash, pulse, markScanned, markFailed };
}

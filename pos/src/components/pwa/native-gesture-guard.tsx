"use client";

import { useEffect } from "react";
import { installZoomGuards } from "@store/shared/lib/nativeGestures";

// iOS ignores the viewport's no-zoom, so pinches are cancelled here; data-allow-zoom subtrees are left alone.
export function NativeGestureGuard() {
  useEffect(() => installZoomGuards(document), []);
  return null;
}

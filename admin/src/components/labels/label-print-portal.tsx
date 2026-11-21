"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { printedPageSizeMm } from "@/lib/labels";
import { LABEL_PRINTING_BODY_CLASS, LABEL_PRINT_ROOT_ID } from "@/constants/labels";
import type { LabelGeometry } from "@/types/label";

// Portalled under <body> so the print CSS can hide everything else; the body class limits it to this screen.

function mm(value: number, fallback: number): string {
  return `${Number.isFinite(value) && value > 0 ? value : fallback}mm`;
}

// @page is document-level, so it can't be a style attribute or utility class.
function pageRule(geometry: LabelGeometry): string {
  const { widthMm, heightMm } = printedPageSizeMm(geometry);
  const size = geometry.printMode === "A4_GRID" ? "A4" : `${mm(widthMm, 50)} ${mm(heightMm, 30)}`;
  // The sheet draws its own margins; the browser's would push the grid off the paper.
  return `@page { size: ${size}; margin: 0; }`;
}

// There is no server <body> to portal into, so rendering waits for the client.
const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function LabelPrintPortal({ geometry, children }: { geometry: LabelGeometry; children: ReactNode }) {
  const isClient = useSyncExternalStore(subscribeToNothing, onClient, onServer);

  useEffect(() => {
    document.body.classList.add(LABEL_PRINTING_BODY_CLASS);
    return () => document.body.classList.remove(LABEL_PRINTING_BODY_CLASS);
  }, []);

  if (!isClient) {
    return null;
  }

  return createPortal(
    <div id={LABEL_PRINT_ROOT_ID}>
      <style>{pageRule(geometry)}</style>
      {children}
    </div>,
    document.body,
  );
}

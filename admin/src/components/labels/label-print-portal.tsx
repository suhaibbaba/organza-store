"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { printedPageSizeMm } from "@/lib/labels";
import { LABEL_PRINTING_BODY_CLASS, LABEL_PRINT_ROOT_ID } from "@/constants/labels";
import type { LabelGeometry } from "@/types/label";

// The copy of the sheet that the browser actually prints.
//
// It is portalled to a direct child of <body> so the print rules in
// globals.css can hide everything else with one selector, instead of trying
// to hide the app chrome around a deeply nested node — which is how labels
// end up shifted by a stray padding or clipped by a scroll container. On
// screen it is display:none; the page shows its own preview built from the
// same <LabelSheet>, so the two can't drift apart.
//
// The body class scopes those rules to this screen: Ctrl+P anywhere else in
// the admin still prints that screen normally.

// A number straight from the Setting row, guarded before it is written into
// a stylesheet.
function mm(value: number, fallback: number): string {
  return `${Number.isFinite(value) && value > 0 ? value : fallback}mm`;
}

// @page can't be expressed in a style attribute or a utility class — the page
// box is a document-level thing — so the one piece of generated CSS in this
// feature lives here, built from the configured sheet.
function pageRule(geometry: LabelGeometry): string {
  const { widthMm, heightMm } = printedPageSizeMm(geometry);
  const size =
    geometry.printMode === "A4_GRID" ? "A4" : `${mm(widthMm, 50)} ${mm(heightMm, 30)}`;
  // margin: 0 — the sheet draws its own margins, so the browser must not add
  // any of its own on top and push the grid off the paper.
  return `@page { size: ${size}; margin: 0; }`;
}

// There is no server-side <body> to portal into, so rendering waits for the
// client. useSyncExternalStore rather than a mounted flag: no state to set
// from an effect, and no cascading render.
const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function LabelPrintPortal({ geometry, children }: { geometry: LabelGeometry; children: ReactNode }) {
  const isClient = useSyncExternalStore(subscribeToNothing, onClient, onServer);

  // Marks this screen as the one printing labels, so the print rules in
  // globals.css apply here and nowhere else.
  useEffect(() => {
    document.body.classList.add(LABEL_PRINTING_BODY_CLASS);
    return () => document.body.classList.remove(LABEL_PRINTING_BODY_CLASS);
  }, []);

  if (!isClient) return null;

  return createPortal(
    <div id={LABEL_PRINT_ROOT_ID}>
      <style>{pageRule(geometry)}</style>
      {children}
    </div>,
    document.body
  );
}

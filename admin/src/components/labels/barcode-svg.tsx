"use client";

import { useMemo } from "react";
import JsBarcode from "jsbarcode";
import { BARCODE_OPTIONS } from "@/constants/labels";

// SVG, not canvas: bars stay crisp at any printer DPI; the engine is isolated here so it can be swapped.

// EAN-13 is what the backend generates (rule 13); anything else (a SKU stand-in) is drawn as CODE128.
const EAN13_PATTERN = /^\d{13}$/;

// The result is injected as markup, so only plain code characters are allowed through.
const SAFE_CODE_PATTERN = /^[A-Za-z0-9._-]+$/;

const SVG_NS = "http://www.w3.org/2000/svg";

// One render per distinct code, not per sticker.
const markupCache = new Map<string, string | null>();

function drawBarcode(value: string): string | null {
  if (!SAFE_CODE_PATTERN.test(value)) {
    return null;
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  const options = {
    width: BARCODE_OPTIONS.barWidth,
    height: BARCODE_OPTIONS.barHeight,
    fontSize: BARCODE_OPTIONS.fontSize,
    textMargin: BARCODE_OPTIONS.textMargin,
    margin: BARCODE_OPTIONS.margin,
    // The digits under the bars are what a cashier types when a label is scuffed.
    displayValue: true,
    background: "#ffffff",
    lineColor: "#000000",
  };

  try {
    JsBarcode(svg, value, { format: EAN13_PATTERN.test(value) ? "EAN13" : "CODE128", ...options });
    // JsBarcode signals an invalid value (e.g. a bad check digit) by rendering nothing, not by throwing.
    if (!svg.childNodes.length) {
      JsBarcode(svg, value, { format: "CODE128", ...options });
    }
  } catch {
    return null;
  }
  if (!svg.childNodes.length) {
    return null;
  }

  // A viewBox (bare numbers, no "px") lets one render scale to any label size.
  const width = Number.parseFloat(svg.getAttribute("width") ?? "");
  const height = Number.parseFloat(svg.getAttribute("height") ?? "");
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
  }
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  return svg.outerHTML;
}

function getBarcodeMarkup(value: string): string | null {
  if (markupCache.has(value)) {
    return markupCache.get(value) ?? null;
  }
  const markup = drawBarcode(value);
  markupCache.set(value, markup);
  return markup;
}

export function BarcodeSvg({ value }: { value: string }) {
  // Client only: the sheet is never in the first render, so there is nothing to hydrate.
  const markup = useMemo(() => (typeof document === "undefined" ? null : getBarcodeMarkup(value)), [value]);

  if (!markup) {
    // Nothing scannable: print the code as text so the piece can still be typed in.
    return <span className="label-code-fallback">{value}</span>;
  }

  // Safe: generated from a value matched against SAFE_CODE_PATTERN.
  return <span className="label-code-svg" dangerouslySetInnerHTML={{ __html: markup }} />;
}

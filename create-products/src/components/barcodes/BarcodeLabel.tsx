"use client";
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeLabelProps {
  value: string;
  height?: number;
  width?: number;
}

export function BarcodeLabel({ value, height = 50, width = 2 }: BarcodeLabelProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "EAN13",
        height,
        width,
        fontSize: 10,
        margin: 4,
        displayValue: true,
      });
    } catch {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128",
          height,
          width,
          fontSize: 10,
          margin: 4,
          displayValue: true,
        });
      } catch {}
    }
  }, [value, height, width]);

  return <svg ref={ref} />;
}

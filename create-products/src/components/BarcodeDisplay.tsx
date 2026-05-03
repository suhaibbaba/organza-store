"use client";
import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Download, X } from "lucide-react";

interface Props {
  value: string;
  label?: string;
  /** If true, render compact (for grid) — no label above, no download button */
  compact?: boolean;
  /** Height of the barcode bars (px). Default 70 */
  height?: number;
}

function renderBarcode(el: SVGSVGElement | null, value: string, height = 70) {
  if (!el || !value) return;
  try {
    JsBarcode(el, value, {
      format: "CODE128",
      width: 2,
      height,
      displayValue: true, // number always shown at bottom
      fontSize: 13,
      textMargin: 4,
      margin: 10,
      background: "#ffffff",
      lineColor: "#0f172a",
      font: "monospace",
    });
  } catch {
    /* invalid value */
  }
}

/* ── Modal: shown when user clicks the barcode number ─── */
function BarcodeModal({
  value,
  label,
  onClose,
}: {
  value: string;
  label?: string;
  onClose: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    renderBarcode(svgRef.current, value, 120);
  }, [value]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const download = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      canvas.width = img.width * 3;
      canvas.height = img.height * 3;
      ctx.scale(3, 3);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `barcode-${value}.png`;
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {label && (
          <p className="text-sm font-semibold text-slate-700 mb-4 pr-8 leading-snug">
            {label}
          </p>
        )}

        <div className="border-2 border-slate-100 rounded-2xl p-4 bg-white shadow-inner">
          <svg ref={svgRef} className="w-full" />
        </div>

        {/* Value as copyable text */}
        <button
          onClick={() => navigator.clipboard?.writeText(value)}
          className="mt-3 w-full text-center font-mono text-sm font-bold text-slate-700 bg-slate-50 rounded-xl py-2.5 px-3 hover:bg-slate-100 transition-colors cursor-copy"
          title="Click to copy"
        >
          {value}
        </button>

        <button
          onClick={download}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold transition-all active:scale-95 shadow-sm"
          style={{ background: "#235C63" }}
        >
          <Download className="w-4 h-4" />
          Download PNG
        </button>
      </div>
    </div>
  );
}

/* ── Main BarcodeDisplay ─────────────────────────────────── */
export function BarcodeDisplay({
  value,
  label,
  compact = false,
  height = 70,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    renderBarcode(svgRef.current, value, compact ? 50 : height);
  }, [value, compact, height]);

  if (!value) return null;

  if (compact) {
    return (
      <>
        {/* Compact: just svg + clickable value text */}
        <div className="flex flex-col items-center w-full">
          <svg ref={svgRef} className="w-full" />
          <button
            onClick={() => setModalOpen(true)}
            className="font-mono text-[11px] font-bold text-brand-700 hover:text-brand-500 hover:underline mt-1 transition-colors cursor-pointer"
            title="Click to view barcode"
          >
            {value}
          </button>
        </div>
        {modalOpen && (
          <BarcodeModal
            value={value}
            label={label}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        {label && (
          <p className="text-sm font-semibold text-slate-700 text-center">
            {label}
          </p>
        )}

        <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm w-full max-w-xs">
          <svg ref={svgRef} className="w-full" />
        </div>

        {/* Clickable barcode number */}
        <button
          onClick={() => setModalOpen(true)}
          className="font-mono text-sm font-bold px-4 py-2 rounded-xl bg-slate-100 hover:bg-brand-100 text-slate-700 hover:text-brand-700 transition-all cursor-pointer border border-transparent hover:border-brand-200"
          title="Click to open barcode modal"
        >
          {value}
        </button>

        <button
          onClick={() => {
            const svg = svgRef.current;
            if (!svg) return;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;
            const img = new Image();
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            img.onload = () => {
              canvas.width = img.width * 2;
              canvas.height = img.height * 2;
              ctx.scale(2, 2);
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, img.width, img.height);
              ctx.drawImage(img, 0, 0);
              const a = document.createElement("a");
              a.href = canvas.toDataURL("image/png");
              a.download = `barcode-${value}.png`;
              a.click();
              URL.revokeObjectURL(url);
            };
            img.src = url;
          }}
          className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-sm"
          style={{ background: "#235C63" }}
        >
          <Download className="w-4 h-4" />
          Download PNG
        </button>
      </div>

      {modalOpen && (
        <BarcodeModal
          value={value}
          label={label}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

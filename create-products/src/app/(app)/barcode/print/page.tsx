"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  Trash2,
  ArrowLeft,
  Minus,
  Plus,
  CheckSquare,
  Square,
  X,
  Eye,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { barcodeQueue, type SavedBarcode } from "@/lib/barcodeQueue";
import { BarcodeDisplay } from "@/components/BarcodeDisplay";

// ── Single barcode cell in print grid ────────────────────────
function PrintCell({ item }: { item: SavedBarcode }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !item.value) return;
    try {
      JsBarcode(svgRef.current, item.value, {
        format: "CODE128",
        width: 1.8,
        height: 55,
        displayValue: true,
        fontSize: 11,
        textMargin: 3,
        margin: 8,
        background: "#ffffff",
        lineColor: "#000000",
        font: "monospace",
      });
    } catch {
      /* skip invalid */
    }
  }, [item.value]);

  return (
    <div className="barcode-cell">
      <svg ref={svgRef} style={{ width: "100%" }} />
      {item.label && item.label !== item.value && (
        <div className="bc-label" title={item.label}>
          {item.label}
        </div>
      )}
    </div>
  );
}

// ── Row in the queue management table ─────────────────────────
function QueueRow({
  item,
  selected,
  onToggle,
  onCopies,
  onRemove,
  onPreview,
}: {
  item: SavedBarcode;
  selected: boolean;
  onToggle: () => void;
  onCopies: (n: number) => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-brand-50 last:border-0 transition-colors ${selected ? "bg-brand-50" : "hover:bg-slate-50"}`}
    >
      {/* Checkbox */}
      <button onClick={onToggle} className="flex-shrink-0">
        {selected ? (
          <CheckSquare className="w-5 h-5 text-brand-600" />
        ) : (
          <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <button onClick={onPreview} className="text-left w-full group">
          <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-brand-700 transition-colors">
            {item.label || item.value}
          </p>
          <p className="text-xs font-mono text-brand-600 mt-0.5 hover:underline cursor-pointer">
            {item.value}
          </p>
        </button>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {new Date(item.savedAt).toLocaleDateString()}{" "}
          {new Date(item.savedAt).toLocaleTimeString()}
        </p>
        {item.printed && (
          <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 mt-0.5">
            Printed
          </span>
        )}
      </div>

      {/* Copies */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onCopies(item.copies - 1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-bold w-6 text-center text-slate-800">
          {item.copies}
        </span>
        <button
          onClick={() => onCopies(item.copies + 1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Print preview grid ─────────────────────────────────────────
function PrintPreview({ items }: { items: SavedBarcode[] }) {
  // Expand copies
  const expanded: SavedBarcode[] = items.flatMap((item) =>
    Array.from({ length: item.copies }, (_, i) => ({
      ...item,
      id: `${item.id}_${i}`,
    })),
  );

  if (expanded.length === 0) {
    return (
      <p className="text-center text-slate-400 py-12 text-sm">
        No barcodes to preview
      </p>
    );
  }

  return (
    <div className="print-page">
      <div className="barcode-grid">
        {expanded.map((item) => (
          <PrintCell key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function PrintQueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<SavedBarcode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [previewItem, setPreviewItem] = useState<SavedBarcode | null>(null);
  const [printing, setPrinting] = useState(false);

  const reload = useCallback(() => {
    const all = barcodeQueue.getAll();
    setItems(all);
    // Default select = unprinted
    const unprintedIds = new Set(
      all.filter((b) => !b.printed).map((b) => b.id),
    );
    setSelected(unprintedIds);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const displayed = showAll ? items : items.filter((b) => !b.printed);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(displayed.map((b) => b.id)));
  const selectNone = () => setSelected(new Set());

  const updateCopies = (id: string, n: number) => {
    barcodeQueue.setCopies(id, n);
    setItems(barcodeQueue.getAll());
  };

  const removeItem = (id: string) => {
    barcodeQueue.remove(id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    reload();
  };

  const selectedItems = items.filter((b) => selected.has(b.id));
  const totalLabels = selectedItems.reduce((sum, b) => sum + b.copies, 0);

  const handlePrint = () => {
    if (selectedItems.length === 0) return;
    setPrinting(true);
    // Give React a tick to render the print preview
    setTimeout(() => {
      window.print();
      // After print dialog closes, mark as printed
      barcodeQueue.markPrinted(selectedItems.map((b) => b.id));
      reload();
      setPrinting(false);
    }, 100);
  };

  return (
    <>
      {/* ── Screen UI (hidden during print) ─────────── */}
      <div className="no-print max-w-3xl mx-auto px-4 md:px-6 py-5 pb-nav md:pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-brand-100"
            style={{ color: "#235C63" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex-1" style={{ color: "#1a444a" }}>
            Print Queue
          </h1>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: showAll ? "#235C63" : "#e6f0f1",
              color: showAll ? "white" : "#235C63",
            }}
          >
            {showAll ? "Unprinted only" : "Show all"}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "#e6f0f1" }}
            >
              <Printer className="w-8 h-8" style={{ color: "#235C63" }} />
            </div>
            <p className="text-slate-500 font-semibold">No barcodes in queue</p>
            <p className="text-sm text-slate-400">
              Save barcodes from the generator to print them
            </p>
            <button
              onClick={() => router.push("/barcode")}
              className="mt-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background: "#235C63" }}
            >
              Go to Generator
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-brand-100 shadow-sm mb-4">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-50">
                <button
                  onClick={selectAll}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
                >
                  Select all ({displayed.length})
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={selectNone}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  None
                </button>
                <div className="flex-1" />
                {selected.size > 0 && (
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#235C63", color: "white" }}
                  >
                    {selected.size} item{selected.size !== 1 ? "s" : ""} ·{" "}
                    {totalLabels} label{totalLabels !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {displayed.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">
                  {showAll
                    ? "Queue is empty"
                    : "All barcodes have been printed"}
                </p>
              )}

              {displayed.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onToggle={() => toggleSelect(item.id)}
                  onCopies={(n) => updateCopies(item.id, n)}
                  onRemove={() => removeItem(item.id)}
                  onPreview={() => setPreviewItem(item)}
                />
              ))}
            </div>

            {/* Danger zone */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  barcodeQueue.clearPrinted();
                  reload();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear printed
              </button>
              <button
                onClick={() => {
                  barcodeQueue.clearAll();
                  reload();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear all
              </button>
            </div>

            {/* Print button */}
            <div className="sticky bottom-20 md:bottom-4">
              <button
                onClick={handlePrint}
                disabled={selected.size === 0 || printing}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white text-base font-bold shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: selected.size === 0 ? "#aadde1" : "#235C63",
                }}
              >
                <Printer className="w-5 h-5" />
                {printing
                  ? "Opening print dialog…"
                  : `Print ${totalLabels} label${totalLabels !== 1 ? "s" : ""} (A4 grid)`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Barcode preview modal ─────────────────────── */}
      {previewItem && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-slate-800 truncate pr-4">
                {previewItem.label}
              </p>
              <button
                onClick={() => setPreviewItem(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <BarcodeDisplay
              value={previewItem.value}
              label={previewItem.label}
            />
          </div>
        </div>
      )}

      {/* ── Print-only content ────────────────────────── */}
      <div style={{ display: "none" }} className="print-only" id="print-area">
        <PrintPreview items={selectedItems} />
      </div>

      {/* Show print area during print via CSS */}
      <style jsx global>{`
        @media print {
          #print-area {
            display: block !important;
          }
          body > * {
            display: none !important;
          }
          #print-area {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}

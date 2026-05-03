"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, BookmarkPlus, Check, Printer } from "lucide-react";
import { getProducts } from "@/lib/api";
import { BarcodeDisplay } from "@/components/BarcodeDisplay";
import { Spinner } from "@/components/ui/Spinner";
import { barcodeQueue } from "@/lib/barcodeQueue";
import type { Product, Variant } from "@/types";
import Link from "next/link";

function BarcodeContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [copies, setCopies] = useState(1);
  const [saved, setSaved] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    setQueueCount(barcodeQueue.unprintedCount());
  }, []);

  useEffect(() => {
    const sku = searchParams.get("sku");
    if (sku) setBarcodeValue(sku);
  }, [searchParams]);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      setProducts((await getProducts(query)).products);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  const pickProduct = (p: Product) => {
    setSelectedProduct(p);
    setSelectedVariant(null);
    setBarcodeValue("");
    setShowProducts(false);
    setQ("");
    setSaved(false);
    if (p.variants?.length === 1) {
      const v = p.variants[0];
      setSelectedVariant(v);
      setBarcodeValue(v.barcode || v.sku || "");
    }
  };

  const pickVariant = (v: Variant) => {
    setSelectedVariant(v);
    setBarcodeValue(v.barcode || v.sku || "");
    setSaved(false);
  };

  const variantLabel = selectedVariant
    ? selectedVariant.options?.map((o) => o.value).join(" / ") ||
      selectedVariant.title ||
      "Default"
    : "";

  const fullLabel = selectedProduct
    ? [selectedProduct.title, variantLabel].filter(Boolean).join(" — ")
    : "";

  const saveToQueue = () => {
    if (!barcodeValue) return;
    barcodeQueue.add({
      value: barcodeValue,
      label: fullLabel || barcodeValue,
      productTitle: selectedProduct?.title || "",
      variantLabel,
      sku: selectedVariant?.sku || barcodeValue,
      copies,
    });
    setSaved(true);
    setQueueCount(barcodeQueue.unprintedCount());
    // reset after 2s
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-5 pb-nav md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold" style={{ color: "#1a444a" }}>
          Barcode Generator
        </h1>
        <Link
          href="/barcode/print"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all relative"
          style={{ background: "#235C63", color: "white" }}
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Print Queue</span>
          {queueCount > 0 && (
            <span className="min-w-[18px] h-[18px] bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {queueCount}
            </span>
          )}
        </Link>
      </div>

      {/* Product search */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-4 mb-4">
        <p
          className="text-xs font-bold uppercase tracking-wider mb-2.5"
          style={{ color: "#235C63" }}
        >
          Search Product
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShowProducts(true);
            }}
            onFocus={() => setShowProducts(true)}
            placeholder="Search product…"
            className="w-full pl-9 pr-4 py-2.5 bg-brand-50 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all"
            style={
              {
                "--tw-ring-color": "rgba(35,92,99,0.25)",
              } as React.CSSProperties
            }
          />
        </div>

        {/* Dropdown */}
        {showProducts && q.length >= 2 && (
          <div className="relative">
            <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-brand-100 z-50 overflow-hidden max-h-56 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Spinner />
                </div>
              ) : products.length === 0 ? (
                <p className="text-center py-6 text-sm text-slate-400">
                  No products found
                </p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => pickProduct(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-50 transition-colors text-left border-b border-slate-50 last:border-0"
                  >
                    {p.thumbnail ? (
                      <img
                        src={p.thumbnail}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-brand-100" />
                    )}
                    <span className="text-sm font-semibold text-slate-900">
                      {p.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected product + variant picker */}
      {selectedProduct && (
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-4 mb-4 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            {selectedProduct.thumbnail && (
              <img
                src={selectedProduct.thumbnail}
                alt=""
                className="w-12 h-12 rounded-xl object-cover border border-brand-100"
              />
            )}
            <div>
              <p className="font-bold" style={{ color: "#1a444a" }}>
                {selectedProduct.title}
              </p>
              <p className="text-xs text-slate-400">
                {selectedProduct.variants?.length} variant(s)
              </p>
            </div>
          </div>

          {selectedProduct.variants && selectedProduct.variants.length > 1 && (
            <div className="space-y-2">
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#235C63" }}
              >
                Select Variant
              </p>
              <div className="grid grid-cols-2 gap-2">
                {selectedProduct.variants.map((v) => {
                  const optLabel =
                    v.options?.map((o) => o.value).join(" / ") ||
                    v.title ||
                    "Default";
                  const isActive = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => pickVariant(v)}
                      className="text-left px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all"
                      style={{
                        borderColor: isActive ? "#235C63" : "#e2e8f0",
                        background: isActive ? "rgba(35,92,99,0.08)" : "white",
                        color: isActive ? "#235C63" : "#475569",
                      }}
                    >
                      <p>{optLabel}</p>
                      {v.sku && (
                        <p className="text-[10px] opacity-60 mt-0.5 font-mono">
                          {v.sku}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual barcode input */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-4 mb-4">
        <p
          className="text-xs font-bold uppercase tracking-wider mb-2.5"
          style={{ color: "#235C63" }}
        >
          Barcode Value
        </p>
        <input
          value={barcodeValue}
          onChange={(e) => {
            setBarcodeValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Enter SKU, barcode, or any value…"
          className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:border-transparent transition-all"
          style={
            { "--tw-ring-color": "rgba(35,92,99,0.3)" } as React.CSSProperties
          }
        />
      </div>

      {/* Barcode preview + actions */}
      {barcodeValue && (
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5 mb-4 animate-fade-in">
          <p
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: "#235C63" }}
          >
            Preview — click the number to enlarge
          </p>
          <BarcodeDisplay value={barcodeValue} label={fullLabel || undefined} />

          {/* Save to queue */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: "#235C63" }}
            >
              Save to Print Queue
            </p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-500 font-medium">
                  Copies
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={copies}
                  onChange={(e) =>
                    setCopies(
                      Math.max(1, Math.min(100, parseInt(e.target.value) || 1)),
                    )
                  }
                  className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 transition-all"
                  style={
                    {
                      "--tw-ring-color": "rgba(35,92,99,0.3)",
                    } as React.CSSProperties
                  }
                />
              </div>
              <button
                onClick={saveToQueue}
                disabled={saved}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95"
                style={{ background: saved ? "#2d7a83" : "#235C63" }}
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4" /> Saved!
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-4 h-4" /> Save to Queue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BarcodePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Spinner size="lg" />
        </div>
      }
    >
      <BarcodeContent />
    </Suspense>
  );
}

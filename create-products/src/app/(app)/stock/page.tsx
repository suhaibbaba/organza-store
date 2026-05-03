"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { getProducts, quickUpdateStock } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import type { Product } from "@/types";

interface FlatVariant {
  productId: string;
  productTitle: string;
  productThumb: string | null;
  variantId: string;
  variantTitle: string;
  sku: string | null;
  stock: number;
  pendingStock: number | null;
  saving: boolean;
}

const LOW_STOCK = 5;

export default function StockPage() {
  const [rows, setRows] = useState<FlatVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low">("all");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Load up to 100 products
      const [p1, p2] = await Promise.all([
        getProducts("", 0),
        getProducts("", 25),
      ]);
      const allProducts: Product[] = [
        ...p1.products,
        ...p2.products.filter((p) => !p1.products.find((x) => x.id === p.id)),
      ];

      const flat: FlatVariant[] = [];
      for (const p of allProducts) {
        for (const v of p.variants || []) {
          flat.push({
            productId: p.id,
            productTitle: p.title,
            productThumb: p.thumbnail,
            variantId: v.id,
            variantTitle:
              v.options?.map((o) => o.value).join(" / ") ||
              v.title ||
              "Default",
            sku: v.sku,
            stock: v.inventory_quantity ?? 0,
            pendingStock: null,
            saving: false,
          });
        }
      }
      setRows(flat);
    } catch {
      toast.error("Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const adjust = (variantId: string, delta: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.variantId === variantId
          ? {
              ...r,
              pendingStock: Math.max(0, (r.pendingStock ?? r.stock) + delta),
            }
          : r,
      ),
    );
  };

  const setPending = (variantId: string, val: string) => {
    const n = parseInt(val);
    if (isNaN(n)) return;
    setRows((prev) =>
      prev.map((r) =>
        r.variantId === variantId ? { ...r, pendingStock: Math.max(0, n) } : r,
      ),
    );
  };

  const saveStock = async (row: FlatVariant) => {
    if (row.pendingStock === null || row.pendingStock === row.stock) return;
    setRows((prev) =>
      prev.map((r) =>
        r.variantId === row.variantId ? { ...r, saving: true } : r,
      ),
    );
    try {
      await quickUpdateStock(row.productId, row.variantId, row.pendingStock);
      setRows((prev) =>
        prev.map((r) =>
          r.variantId === row.variantId
            ? {
                ...r,
                stock: r.pendingStock!,
                pendingStock: null,
                saving: false,
              }
            : r,
        ),
      );
      toast.success("Stock updated");
    } catch {
      toast.error("Failed to update stock");
      setRows((prev) =>
        prev.map((r) =>
          r.variantId === row.variantId ? { ...r, saving: false } : r,
        ),
      );
    }
  };

  const filtered = rows.filter((r) => {
    const matchQ =
      !q ||
      r.productTitle.toLowerCase().includes(q.toLowerCase()) ||
      r.sku?.includes(q);
    const matchFilter = filter === "all" || r.stock <= LOW_STOCK;
    return matchQ && matchFilter;
  });

  const lowCount = rows.filter((r) => r.stock <= LOW_STOCK).length;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Stock</h1>
          {lowCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {lowCount} low
            </div>
          )}
        </div>
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600/30 transition-all"
          />
        </div>
        {/* Filter tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1">
          {(
            [
              ["all", "All"],
              ["low", `Low Stock ≤${LOW_STOCK}`],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filter === val
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-nav px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <Package className="w-10 h-10" />
            <p className="text-sm">No variants found</p>
          </div>
        ) : (
          filtered.map((row) => {
            const displayStock = row.pendingStock ?? row.stock;
            const isDirty =
              row.pendingStock !== null && row.pendingStock !== row.stock;
            const isLow = row.stock <= LOW_STOCK;

            return (
              <div
                key={row.variantId}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isLow ? "border-amber-200" : "border-slate-100"}`}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden">
                    {row.productThumb ? (
                      <img
                        src={row.productThumb}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-300" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {row.productTitle}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {row.variantTitle}
                    </p>
                    {row.sku && (
                      <p className="text-[10px] text-slate-400">
                        SKU: {row.sku}
                      </p>
                    )}
                    {isLow && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 mt-0.5">
                        <AlertTriangle className="w-3 h-3" /> Low stock
                      </span>
                    )}
                  </div>

                  {/* Stock control */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => adjust(row.variantId, -1)}
                      disabled={row.saving}
                      className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition-all"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={displayStock}
                      onChange={(e) =>
                        setPending(row.variantId, e.target.value)
                      }
                      className={`w-12 text-center text-sm font-bold border-2 rounded-lg py-1.5 focus:outline-none transition-colors ${
                        isDirty
                          ? "border-indigo-400 text-brand-700 bg-brand-50"
                          : "border-slate-200 text-slate-900 bg-white"
                      }`}
                    />
                    <button
                      onClick={() => adjust(row.variantId, 1)}
                      disabled={row.saving}
                      className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition-all"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Save bar */}
                {isDirty && (
                  <div className="flex border-t border-indigo-100 bg-brand-50">
                    <button
                      onClick={() =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.variantId === row.variantId
                              ? { ...r, pendingStock: null }
                              : r,
                          ),
                        )
                      }
                      className="flex-1 py-2 text-xs font-medium text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveStock(row)}
                      disabled={row.saving}
                      className="flex-1 py-2 text-xs font-bold text-brand-600 border-l border-indigo-100 flex items-center justify-center gap-1.5"
                    >
                      {row.saving ? <Spinner size="sm" /> : "Save"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

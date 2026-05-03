"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X, ChevronRight, Package } from "lucide-react";
import { getProducts } from "@/lib/api";
import { statusColor } from "@/lib/utils";
import type { Product } from "@/types";
import { Spinner } from "@/components/ui/Spinner";

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const load = useCallback(
    async (query = "") => {
      try {
        const data = await getProducts(query);
        setProducts(data.products);
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "unauthorized")
          router.push("/login");
      } finally {
        setLoading(false);
        setSearching(false);
      }
    },
    [router],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (q.length === 0) {
      load("");
      return;
    }
    if (q.length < 2) return;
    setSearching(true);
    const t = setTimeout(() => load(q), 400);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-900">Products</h1>
        <button
          onClick={() => router.push("/products/new")}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all shadow-sm hover:bg-brand-500"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 shadow-sm transition-all"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Grid on desktop, list on mobile */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" />
        </div>
      ) : searching ? (
        <div className="flex items-center justify-center h-24">
          <Spinner />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
          <Package className="w-12 h-12" />
          <p className="text-sm">
            {q ? "No products found" : "No products yet"}
          </p>
          {!q && (
            <button
              onClick={() => router.push("/products/new")}
              className="text-brand-600 text-sm font-semibold hover:underline"
            >
              Add your first product →
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: grid */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/products/${p.id}`)}
                className="group text-left bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all overflow-hidden active:scale-[0.98]"
              >
                <div className="aspect-video bg-slate-100 overflow-hidden">
                  {p.thumbnail ? (
                    <img
                      src={p.thumbnail}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-semibold text-slate-900 truncate">
                    {p.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {p.variants?.length ?? 0} variant
                    {(p.variants?.length ?? 0) !== 1 ? "s" : ""}
                    {p.collection && (
                      <span className="text-brand-500">
                        {" "}
                        · {p.collection.title}
                      </span>
                    )}
                  </p>
                  <span
                    className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(p.status)}`}
                  >
                    {p.status}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Mobile: list */}
          <div className="md:hidden space-y-2">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/products/${p.id}`)}
                className="w-full flex items-center gap-3 bg-white rounded-2xl p-3 border border-slate-100 shadow-sm active:scale-[0.98] transition-all text-left"
              >
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden">
                  {p.thumbnail ? (
                    <img
                      src={p.thumbnail}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-7 h-7 text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate text-sm">
                    {p.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.variants?.length ?? 0} variant
                    {(p.variants?.length ?? 0) !== 1 ? "s" : ""}
                    {p.collection && (
                      <span className="text-brand-500">
                        {" "}
                        · {p.collection.title}
                      </span>
                    )}
                  </p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(p.status)}`}
                  >
                    {p.status}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

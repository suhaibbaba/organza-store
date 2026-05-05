"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sdk, PRODUCT_FIELDS } from "@/lib/sdk";
import { AppLayout } from "@/components/layout/AppLayout";
import { Plus, Search, Package, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

const STATUS_COLORS = {
  published: "bg-green-100 text-green-700",
  draft: "bg-amber-100 text-amber-700",
  proposed: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
};

export default function ProductsPage() {
  const locale = useLocale();
  const t = useTranslations("products");
  const tNav = useTranslations("nav");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const limit = 12;

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, status, page],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        limit,
        offset: page * limit,
        fields: PRODUCT_FIELDS,
      };
      if (search) params.q = search;
      if (status) params.status = status;
      return sdk.admin.product.list(params as Parameters<typeof sdk.admin.product.list>[0]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.admin.product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("deleteSuccess"));
    },
    onError: () => toast.error("Failed to delete product"),
  });

  const handleDelete = (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    deleteMutation.mutate(id);
  };

  const products = (data as { products: Array<Record<string, unknown>> } | undefined)?.products || [];
  const count = (data as { count: number } | undefined)?.count || 0;
  const totalPages = Math.ceil(count / limit);

  return (
    <AppLayout title={tNav("products")}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder={t("search")}
              className="w-full ps-9 pe-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm bg-white"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-sm bg-white"
          >
            <option value="">{t("all")}</option>
            <option value="published">{t("published")}</option>
            <option value="draft">{t("draft")}</option>
            <option value="proposed">{t("proposed")}</option>
            <option value="rejected">{t("rejected")}</option>
          </select>
          <Link
            href={`/${locale}/products/new`}
            className="flex items-center gap-2 btn-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
          >
            <Plus size={16} />
            {t("create")}
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm h-64 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Package size={48} className="mb-3 opacity-30" />
            <p>{t("noProducts")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((p) => {
              const meta = (p.metadata as Record<string, string>) || {};
              const title = locale === "ar" && meta.title_ar ? meta.title_ar : (p.title as string);
              const variants = (p.variants as unknown[]) || [];
              const collection = p.collection as { title: string } | null;
              const status = p.status as string;

              return (
                <div key={p.id as string} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group">
                  <div className="relative h-40 bg-slate-50 flex items-center justify-center">
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail as string} alt={title} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={32} className="text-slate-300" />
                    )}
                    <span className={cn(
                      "absolute top-2 end-2 px-2 py-0.5 rounded-full text-xs font-medium",
                      STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "bg-slate-100 text-slate-600"
                    )}>
                      {status}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-800 text-sm leading-tight truncate">{title}</h3>
                    {collection && <p className="text-xs text-slate-400 mt-0.5">{collection.title}</p>}
                    <p className="text-xs text-slate-400 mt-1">{variants.length} {t("variants")}</p>
                    <div className="flex gap-2 mt-3">
                      <Link
                        href={`/${locale}/products/${p.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-brand-600 text-brand-600 rounded-xl text-xs font-medium hover:bg-brand-50 transition-colors"
                      >
                        <Pencil size={12} />
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id as string)}
                        className="p-1.5 border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">{count} products · Page {page + 1}/{totalPages}</p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                ←
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

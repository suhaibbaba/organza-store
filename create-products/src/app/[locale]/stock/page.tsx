"use client";
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { sdk, PRODUCT_FIELDS } from "@/lib/sdk";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StockItem {
  productId: string;
  variantId: string;
  productName: string;
  variantTitle: string;
  sku: string;
  quantity: number;
}

export default function StockPage() {
  const t = useTranslations("stock");
  const tNav = useTranslations("nav");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["products-stock"],
    queryFn: async () => {
      const result = await sdk.admin.product.list({ limit: 200, fields: PRODUCT_FIELDS } as Parameters<typeof sdk.admin.product.list>[0]);
      return (result as { products: Array<Record<string, unknown>> }).products;
    },
  });

  const items = useMemo((): StockItem[] => {
    const products = data || [];
    const all: StockItem[] = [];
    products.forEach((p) => {
      const variants = (p.variants as Array<Record<string, unknown>>) || [];
      variants.forEach((v) => {
        all.push({
          productId: p.id as string,
          variantId: v.id as string,
          productName: (p.title as string) || "",
          variantTitle: (v.title as string) || "",
          sku: (v.sku as string) || "",
          quantity: (v.inventory_quantity as number) || 0,
        });
      });
    });
    return all;
  }, [data]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.productName.toLowerCase().includes(q) ||
        i.variantTitle.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q)
    );
  }, [items, search]);

  const key = (i: StockItem) => `${i.productId}::${i.variantId}`;

  const getQty = (item: StockItem) => editing[key(item)] ?? item.quantity;

  const getStatus = (qty: number) => {
    if (qty <= 0) return { label: t("outOfStock"), cls: "bg-red-100 text-red-700" };
    if (qty < 5) return { label: t("lowStock"), cls: "bg-amber-100 text-amber-700" };
    return { label: t("inStock"), cls: "bg-green-100 text-green-700" };
  };

  const handleSave = async (item: StockItem) => {
    const k = key(item);
    const qty = editing[k];
    if (qty === undefined) return;
    setSaving((p) => ({ ...p, [k]: true }));
    try {
      await (sdk.admin.product as unknown as { updateVariant: (pid: string, vid: string, body: unknown) => Promise<unknown> })
        .updateVariant(item.productId, item.variantId, { inventory_quantity: qty });
      toast.success("Saved");
      setEditing((p) => { const n = { ...p }; delete n[k]; return n; });
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving((p) => ({ ...p, [k]: false }));
    }
  };

  return (
    <AppLayout title={tNav("stock")}>
      <div className="space-y-4">
        <div className="relative">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="w-full ps-9 pe-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("product")}</th>
                    <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("variant")}</th>
                    <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("sku")}</th>
                    <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("status")}</th>
                    <th className="text-start px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("quantity")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((item) => {
                    const k = key(item);
                    const qty = getQty(item);
                    const status = getStatus(qty);
                    const isDirty = editing[k] !== undefined;

                    return (
                      <tr key={k} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">{item.productName}</td>
                        <td className="px-4 py-3 text-slate-500">{item.variantTitle}</td>
                        <td className="px-4 py-3 font-mono text-slate-400 text-xs">{item.sku}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", status.cls)}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={qty}
                            onChange={(e) => setEditing((p) => ({ ...p, [k]: Number(e.target.value) }))}
                            className="w-20 px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm"
                            dir="ltr"
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {isDirty && (
                            <button
                              onClick={() => handleSave(item)}
                              disabled={saving[k]}
                              className="px-3 py-1.5 btn-brand text-white rounded-xl text-xs font-medium disabled:opacity-60"
                            >
                              {saving[k] ? "..." : t("save")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

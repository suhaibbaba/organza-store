"use client";
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { sdk, PRODUCT_FIELDS } from "@/lib/sdk";
import { AppLayout } from "@/components/layout/AppLayout";
import { BarcodeLabel } from "@/components/barcodes/BarcodeLabel";
import { BarcodeScanner } from "@/components/barcodes/BarcodeScanner";
import { Search, Camera, Package } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

export default function BarcodesPage() {
  const t = useTranslations("barcodes");
  const tNav = useTranslations("nav");
  const { settings } = useSettings();
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["products-barcodes"],
    queryFn: async () => {
      const result = await sdk.admin.product.list({ limit: 200, fields: PRODUCT_FIELDS } as Parameters<typeof sdk.admin.product.list>[0]);
      return (result as { products: Array<Record<string, unknown>> }).products;
    },
  });

  const items = useMemo(() => {
    const products = data || [];
    const all: Array<{ productName: string; variantTitle: string; sku: string; barcode: string; thumbnail: string }> = [];
    products.forEach((p) => {
      const variants = (p.variants as Array<Record<string, unknown>>) || [];
      variants.forEach((v) => {
        const meta = (v.metadata as Record<string, string>) || {};
        const barcode = meta.barcode || (v.barcode as string) || "";
        const sku = (v.sku as string) || "";
        all.push({
          productName: (p.title as string) || "",
          variantTitle: (v.title as string) || "",
          sku,
          barcode,
          thumbnail: (p.thumbnail as string) || "",
        });
      });
    });

    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(
      (i) =>
        i.barcode.includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.productName.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <AppLayout title={tNav("barcodes")}>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="w-full ps-9 pe-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm"
            />
          </div>
          <button
            onClick={() => setScanning(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50"
          >
            <Camera size={16} />
            {t("scan")}
          </button>
        </div>

        {scanning && (
          <BarcodeScanner onScan={(v) => setSearch(v)} onClose={() => setScanning(false)} />
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 h-48 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center gap-2">
                {item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnail} alt="" className="w-12 h-12 object-cover rounded-lg" />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Package size={20} className="text-slate-300" />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-700 leading-tight">{item.productName}</p>
                  <p className="text-xs text-slate-400">{item.variantTitle}</p>
                </div>
                {item.barcode && (
                  <div className="w-full overflow-hidden">
                    <BarcodeLabel value={item.barcode} height={settings.barcodeHeightPx} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

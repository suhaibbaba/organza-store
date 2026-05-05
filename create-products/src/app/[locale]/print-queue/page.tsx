"use client";
import { useState, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk, PRODUCT_FIELDS } from "@/lib/sdk";
import { AppLayout } from "@/components/layout/AppLayout";
import { BarcodeLabel } from "@/components/barcodes/BarcodeLabel";
import { useSettings } from "@/context/SettingsContext";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QueueItem {
  productId: string;
  variantId: string;
  productName: string;
  variantTitle: string;
  sku: string;
  barcode: string;
  thumbnail: string;
  isPrinted: boolean;
}

export default function PrintQueuePage() {
  const locale = useLocale();
  const t = useTranslations("printQueue");
  const tNav = useTranslations("nav");
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPrinted, setShowPrinted] = useState(false);
  const printRootRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["products-queue"],
    queryFn: async () => {
      const result = await sdk.admin.product.list({ limit: 200, fields: PRODUCT_FIELDS } as Parameters<typeof sdk.admin.product.list>[0]);
      return (result as { products: Array<Record<string, unknown>> }).products;
    },
  });

  const items = useMemo((): QueueItem[] => {
    const products = data || [];
    const all: QueueItem[] = [];
    products.forEach((p) => {
      const variants = (p.variants as Array<Record<string, unknown>>) || [];
      const meta = (p.metadata as Record<string, string>) || {};
      const productName = (locale === "ar" && meta.title_ar) ? meta.title_ar : (p.title as string) || "";
      variants.forEach((v) => {
        const vMeta = (v.metadata as Record<string, unknown>) || {};
        const barcode = (vMeta.barcode as string) || (v.barcode as string) || "";
        all.push({
          productId: p.id as string,
          variantId: v.id as string,
          productName,
          variantTitle: (v.title as string) || "",
          sku: (v.sku as string) || "",
          barcode,
          thumbnail: (p.thumbnail as string) || "",
          isPrinted: vMeta.barcode_is_printed === true,
        });
      });
    });
    return all;
  }, [data, locale]);

  const visibleItems = showPrinted ? items : items.filter((i) => !i.isPrinted);
  const key = (i: QueueItem) => `${i.productId}::${i.variantId}`;

  const toggleSelect = (i: QueueItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key(i))) next.delete(key(i));
      else next.add(key(i));
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(visibleItems.filter((i) => !i.isPrinted).map(key)));
  };

  const markPrinted = async () => {
    if (!selected.size) return;
    if (!confirm(t("markConfirm"))) return;
    const toMark = items.filter((i) => selected.has(key(i)));
    for (const item of toMark) {
      try {
        await (sdk.admin.product as unknown as { updateVariant: (pid: string, vid: string, body: unknown) => Promise<unknown> })
          .updateVariant(item.productId, item.variantId, { metadata: { barcode_is_printed: true } });
      } catch {}
    }
    toast.success(t("markSuccess").replace("{count}", String(toMark.length)));
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["products-queue"] });
  };

  const doPrint = (itemsToPrint: QueueItem[]) => {
    if (!printRootRef.current) return;
    printRootRef.current.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "barcode-grid";
    grid.style.setProperty("--cols", String(settings.barcodesPerRow));
    grid.style.setProperty("--label-w", `${settings.labelWidthMm}mm`);
    grid.style.setProperty("--label-h", `${settings.labelHeightMm}mm`);

    itemsToPrint.forEach((item) => {
      const cell = document.createElement("div");
      cell.className = "barcode-cell";
      if (settings.showProductName) {
        const pn = document.createElement("div");
        pn.style.cssText = "font-size:8px;font-weight:600;text-align:center;margin-bottom:2px;";
        pn.textContent = item.productName;
        cell.appendChild(pn);
      }
      if (settings.showVariantLabel) {
        const vl = document.createElement("div");
        vl.style.cssText = "font-size:7px;color:#555;text-align:center;margin-bottom:2px;";
        vl.textContent = item.variantTitle;
        cell.appendChild(vl);
      }
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      cell.appendChild(svg);
      if (settings.showSku) {
        const sk = document.createElement("div");
        sk.style.cssText = "font-size:7px;color:#555;font-family:monospace;text-align:center;margin-top:2px;";
        sk.textContent = item.sku;
        cell.appendChild(sk);
      }
      grid.appendChild(cell);
    });

    printRootRef.current.appendChild(grid);

    import("jsbarcode").then(({ default: JsBarcode }) => {
      grid.querySelectorAll("svg").forEach((svg, i) => {
        const barcode = itemsToPrint[i]?.barcode;
        if (!barcode) return;
        try {
          JsBarcode(svg, barcode, { format: "EAN13", height: settings.barcodeHeightPx, width: 2, fontSize: 8, margin: 2, displayValue: true });
        } catch {
          try { JsBarcode(svg, barcode, { format: "CODE128", height: settings.barcodeHeightPx, width: 2, fontSize: 8, margin: 2, displayValue: true }); } catch {}
        }
      });
      window.print();
    });
  };

  const selectedItems = items.filter((i) => selected.has(key(i)));

  return (
    <AppLayout title={tNav("printQueue")}>
      <div id="print-root" ref={printRootRef} style={{ display: "none" }} />
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={selectAll} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">
            {t("selectAll")}
          </button>
          <button
            onClick={() => doPrint(selectedItems.length ? selectedItems : visibleItems)}
            className="px-4 py-2 btn-brand text-white rounded-xl text-sm font-semibold"
          >
            {selectedItems.length ? t("printSelected") : t("printAll")}
          </button>
          <button
            onClick={markPrinted}
            disabled={!selected.size}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            {t("markPrinted")}
          </button>
          <label className="flex items-center gap-2 ms-auto cursor-pointer text-sm text-slate-600">
            <input type="checkbox" checked={showPrinted} onChange={(e) => setShowPrinted(e.target.checked)} />
            {t("showPrinted")}
          </label>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 h-40 animate-pulse" />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Package size={48} className="mb-3 opacity-30" />
            <p>{t("empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleItems.map((item) => {
              const k = key(item);
              const isSelected = selected.has(k);
              return (
                <div
                  key={k}
                  onClick={() => toggleSelect(item)}
                  className={cn(
                    "bg-white rounded-2xl border shadow-sm p-4 flex flex-col items-center gap-2 cursor-pointer transition-all",
                    isSelected ? "border-brand-600 ring-2 ring-brand-600/20" : "border-slate-100",
                    item.isPrinted && "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <input type="checkbox" checked={isSelected} onChange={() => {}} className="shrink-0" />
                    {item.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnail} alt="" className="w-10 h-10 object-cover rounded-lg" />
                    ) : (
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                        <Package size={16} className="text-slate-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 leading-tight truncate">{item.productName}</p>
                      <p className="text-xs text-slate-400 truncate">{item.variantTitle}</p>
                    </div>
                  </div>
                  {item.barcode && (
                    <div className="w-full overflow-hidden">
                      <BarcodeLabel value={item.barcode} height={40} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

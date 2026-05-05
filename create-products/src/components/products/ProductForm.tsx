"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { sdk } from "@/lib/sdk";
import {
  cn, slugify, randomSuffix, generateSKU, generateBarcode, generateCombinations,
} from "@/lib/utils";
import { OPTION_PRESETS } from "@/lib/defaults";
import { ProductFormData, FormOption, FormVariant } from "@/types";
import { useSettings } from "@/context/SettingsContext";
import {
  ChevronDown, ChevronUp, Plus, X, GripVertical, Check, Loader2, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

interface ProductFormProps {
  product?: Record<string, unknown>;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  isCreate?: boolean;
}

function Section({
  title, icon, children, defaultOpen = false,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-brand-600">{icon}</span>
          <span className="font-semibold text-slate-800">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm",
        props.className
      )}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={cn(
        "w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm resize-none",
        props.className
      )}
    />
  );
}

function buildDefaultForm(product?: Record<string, unknown>): ProductFormData {
  if (!product) {
    return {
      title: "", title_ar: "", subtitle: "", subtitle_ar: "",
      description: "", description_ar: "", handle: "",
      status: "draft", thumbnail: "", images: [],
      collection_id: "", categoryIds: [], type_id: "",
      tags: [], weight: "", length: "", width: "", height: "",
      hs_code: "", material: "", origin_country: "",
      price: 0, currency_code: "ILS",
      hasVariants: false, options: [], variants: [],
    };
  }

  const meta = (product.metadata as Record<string, string>) || {};
  const cats = (product.categories as Array<{ id: string }>) || [];
  const imgs = (product.images as Array<{ url: string }>) || [];
  const tags = (product.tags as Array<{ value: string }>) || [];
  const rawVariants = (product.variants as Array<Record<string, unknown>>) || [];
  const rawOptions = (product.options as Array<{ title: string; values: Array<{ value: string }> }>) || [];

  const options: FormOption[] = rawOptions.map((o) => ({
    title: o.title,
    values: o.values?.map((v) => v.value) || [],
  }));

  const firstVariant = rawVariants[0];
  const firstPrice = firstVariant
    ? ((firstVariant.prices as Array<{ amount: number; currency_code: string }>) || [])[0]
    : null;

  const variants: FormVariant[] = rawVariants.map((v) => {
    const vMeta = (v.metadata as Record<string, unknown>) || {};
    const prices = (v.prices as Array<{ amount: number; currency_code: string }>) || [];
    const opts = (v.options as Array<{ option: { title: string }; value: string }>) || [];
    const optMap: Record<string, string> = {};
    opts.forEach((o) => { if (o.option?.title) optMap[o.option.title] = o.value; });

    return {
      id: (v.id as string) || undefined,
      title: (v.title as string) || "",
      sku: (v.sku as string) || "",
      barcode: (v.barcode as string) || (vMeta.barcode as string) || "",
      options: optMap,
      price: prices[0]?.amount || 0,
      stock: 0,
      metadata: {
        barcode: (vMeta.barcode as string) || "",
        barcode_is_printed: (vMeta.barcode_is_printed as boolean) || false,
      },
    };
  });

  return {
    title: (product.title as string) || "",
    title_ar: meta.title_ar || "",
    subtitle: (product.subtitle as string) || "",
    subtitle_ar: meta.subtitle_ar || "",
    description: (product.description as string) || "",
    description_ar: meta.description_ar || "",
    handle: (product.handle as string) || "",
    status: (product.status as "draft" | "published") || "draft",
    thumbnail: (product.thumbnail as string) || "",
    images: imgs.map((i) => i.url),
    collection_id: (product.collection as { id: string } | null)?.id || "",
    categoryIds: cats.map((c) => c.id),
    type_id: (product.type as { id: string } | null)?.id || "",
    tags: tags.map((t) => t.value),
    weight: String(product.weight || ""),
    length: String(product.length || ""),
    width: String(product.width || ""),
    height: String(product.height || ""),
    hs_code: (product.hs_code as string) || "",
    material: (product.material as string) || "",
    origin_country: (product.origin_country as string) || "",
    price: firstPrice?.amount || 0,
    currency_code: firstPrice?.currency_code?.toUpperCase() || "ILS",
    hasVariants: rawOptions.length > 0,
    options,
    variants,
  };
}

export function ProductForm({ product, onSave, isCreate = false }: ProductFormProps) {
  const t = useTranslations("form");
  const locale = useLocale();
  const { currency } = useSettings();
  const [form, setForm] = useState<ProductFormData>(() => buildDefaultForm(product));
  const [saving, setSaving] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionValues, setNewOptionValues] = useState<Record<number, string>>({});
  const [collections, setCollections] = useState<Array<{ id: string; title: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [types, setTypes] = useState<Array<{ id: string; value: string }>>([]);

  useEffect(() => {
    sdk.admin.productCollection.list({ limit: 100 }).then((r) => setCollections((r as { collections: Array<{ id: string; title: string }> }).collections || [])).catch(() => {});
    sdk.admin.productCategory.list({ limit: 100 }).then((r) => setCategories((r as { product_categories: Array<{ id: string; name: string }> }).product_categories || [])).catch(() => {});
    sdk.admin.productType.list({ limit: 100 }).then((r) => setTypes((r as { product_types: Array<{ id: string; value: string }> }).product_types || [])).catch(() => {});
  }, []);

  const set = useCallback(<K extends keyof ProductFormData>(key: K, val: ProductFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleTitleEnChange = (val: string) => {
    set("title", val);
    if (isCreate) {
      set("handle", val ? `${slugify(val)}-${randomSuffix()}` : "");
    }
  };

  const handlePriceChange = (price: number) => {
    set("price", price);
    setForm((prev) => ({
      ...prev,
      price,
      variants: prev.variants.map((v) => ({ ...v, price })),
    }));
  };

  const rebuildVariants = useCallback((opts: FormOption[], baseTitle: string, basePrice: number) => {
    const combos = generateCombinations(opts);
    if (!combos.length) return [];
    return combos.map((combo) => {
      const vals = Object.values(combo);
      const title = vals.join(" / ");
      const sku = generateSKU(baseTitle || "ORG", vals);
      const barcode = generateBarcode(sku);
      return {
        title,
        sku,
        barcode,
        options: combo,
        price: basePrice,
        stock: 0,
        metadata: { barcode, barcode_is_printed: false },
      };
    });
  }, []);

  const addOption = (title: string, values: string[] = []) => {
    const newOpts = [...form.options, { title, values }];
    const newVariants = rebuildVariants(newOpts, form.title, form.price);
    setForm((prev) => ({ ...prev, options: newOpts, variants: newVariants }));
  };

  const removeOption = (i: number) => {
    const newOpts = form.options.filter((_, idx) => idx !== i);
    const newVariants = rebuildVariants(newOpts, form.title, form.price);
    setForm((prev) => ({ ...prev, options: newOpts, variants: newVariants }));
  };

  const addValueToOption = (optIdx: number, value: string) => {
    if (!value.trim()) return;
    const newOpts = form.options.map((o, i) =>
      i === optIdx ? { ...o, values: [...o.values, value.trim()] } : o
    );
    const newVariants = rebuildVariants(newOpts, form.title, form.price);
    setForm((prev) => ({ ...prev, options: newOpts, variants: newVariants }));
  };

  const removeValueFromOption = (optIdx: number, valIdx: number) => {
    const newOpts = form.options.map((o, i) =>
      i === optIdx ? { ...o, values: o.values.filter((_, vi) => vi !== valIdx) } : o
    );
    const newVariants = rebuildVariants(newOpts, form.title, form.price);
    setForm((prev) => ({ ...prev, options: newOpts, variants: newVariants }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const currCode = (form.currency_code || currency || "ILS").toLowerCase();
      const body: Record<string, unknown> = {
        title: form.title,
        subtitle: form.subtitle || undefined,
        description: form.description || undefined,
        handle: form.handle || undefined,
        status: form.status,
        thumbnail: form.thumbnail || undefined,
        images: form.images.length ? form.images.map((url) => ({ url })) : undefined,
        collection_id: form.collection_id || undefined,
        categories: form.categoryIds.length ? form.categoryIds.map((id) => ({ id })) : undefined,
        type_id: form.type_id || undefined,
        tags: form.tags.length ? form.tags.map((v) => ({ value: v })) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        length: form.length ? Number(form.length) : undefined,
        width: form.width ? Number(form.width) : undefined,
        height: form.height ? Number(form.height) : undefined,
        hs_code: form.hs_code || undefined,
        material: form.material || undefined,
        origin_country: form.origin_country || undefined,
        metadata: {
          title_ar: form.title_ar || undefined,
          subtitle_ar: form.subtitle_ar || undefined,
          description_ar: form.description_ar || undefined,
        },
      };

      if (form.hasVariants && form.options.length) {
        body.options = form.options.map((o) => ({ title: o.title, values: o.values }));
        body.variants = form.variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          title: v.title,
          sku: v.sku,
          barcode: v.barcode,
          options: v.options,
          prices: [{ currency_code: currCode, amount: Math.round(v.price) }],
          metadata: { barcode: v.barcode, barcode_is_printed: false },
        }));
      } else {
        const existingVariant = form.variants[0];
        const sku = existingVariant?.sku || generateSKU(form.title || "ORG");
        const barcode = existingVariant?.barcode || generateBarcode(sku);
        body.variants = [{
          ...(existingVariant?.id ? { id: existingVariant.id } : {}),
          title: "Default Title",
          sku,
          barcode,
          prices: [{ currency_code: currCode, amount: Math.round(form.price) }],
          metadata: { barcode, barcode_is_printed: false },
        }];
      }

      await onSave(body);
    } catch (err) {
      toast.error("Failed to save product");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const isRtl = locale === "ar";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* General */}
      <Section title={t("general")} icon={<span>📝</span>} defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 text-[10px] font-bold">EN</span>
                {t("titleEn")}
              </span>
            </Label>
            <Input
              dir="ltr"
              value={form.title}
              onChange={(e) => handleTitleEnChange(e.target.value)}
              placeholder="Product name"
            />
          </div>
          <div>
            <Label>
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 text-[10px] font-bold">AR</span>
                {t("titleAr")}
              </span>
            </Label>
            <Input
              dir="rtl"
              value={form.title_ar}
              onChange={(e) => set("title_ar", e.target.value)}
              placeholder="اسم المنتج"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("subtitleEn")}</Label>
            <Input dir="ltr" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Subtitle" />
          </div>
          <div>
            <Label>{t("subtitleAr")}</Label>
            <Input dir="rtl" value={form.subtitle_ar} onChange={(e) => set("subtitle_ar", e.target.value)} placeholder="العنوان الفرعي" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("descriptionEn")}</Label>
            <Textarea dir="ltr" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Description..." />
          </div>
          <div>
            <Label>{t("descriptionAr")}</Label>
            <Textarea dir="rtl" value={form.description_ar} onChange={(e) => set("description_ar", e.target.value)} placeholder="الوصف..." />
          </div>
        </div>

        <div>
          <Label>{t("handle")}</Label>
          <Input
            dir="ltr"
            value={form.handle}
            onChange={(e) => set("handle", e.target.value)}
            placeholder="product-handle"
            className="font-mono"
          />
          <p className="text-xs text-slate-400 mt-1">{t("handleHint")}</p>
        </div>
      </Section>

      {/* Media */}
      <Section title={t("media")} icon={<span>🖼️</span>}>
        <div>
          <Label>{t("thumbnail")}</Label>
          <Input dir="ltr" value={form.thumbnail} onChange={(e) => set("thumbnail", e.target.value)} placeholder="https://..." />
          {form.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.thumbnail} alt="thumbnail" className="mt-2 h-24 w-24 object-cover rounded-xl border border-slate-100" />
          )}
        </div>
        <div>
          <Label>{t("additionalImages")}</Label>
          <div className="space-y-2">
            {form.images.map((url, i) => (
              <div key={i} className="flex gap-2">
                <Input dir="ltr" value={url} onChange={(e) => set("images", form.images.map((u, j) => j === i ? e.target.value : u))} />
                <button type="button" onClick={() => set("images", form.images.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-500">
                  <X size={16} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                dir="ltr"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder={t("addImage")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (newImageUrl.trim()) { set("images", [...form.images, newImageUrl.trim()]); setNewImageUrl(""); }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => { if (newImageUrl.trim()) { set("images", [...form.images, newImageUrl.trim()]); setNewImageUrl(""); } }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Organize */}
      <Section title={t("organize")} icon={<span>🗂️</span>}>
        <div>
          <Label>{t("status")}</Label>
          <div className="flex gap-2">
            {(["draft", "published"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("status", s)}
                className={cn(
                  "flex-1 py-2 rounded-xl border text-sm font-medium transition-colors",
                  form.status === s
                    ? "border-brand-600 text-brand-600 bg-brand-50"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                {s === "draft" ? t("draft") : t("published")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>{t("productType")}</Label>
          <select
            value={form.type_id}
            onChange={(e) => set("type_id", e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm bg-white"
          >
            <option value="">—</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.value}</option>)}
          </select>
        </div>

        <div>
          <Label>{t("collection")}</Label>
          <select
            value={form.collection_id}
            onChange={(e) => set("collection_id", e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm bg-white"
          >
            <option value="">—</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        <div>
          <Label>{t("categories")}</Label>
          <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5">
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg">
                <input
                  type="checkbox"
                  checked={form.categoryIds.includes(cat.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      set("categoryIds", [...form.categoryIds, cat.id]);
                    } else {
                      set("categoryIds", form.categoryIds.filter((id) => id !== cat.id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm text-slate-700">{cat.name}</span>
              </label>
            ))}
            {categories.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No categories</p>}
          </div>
        </div>

        <div>
          <Label>{t("tags")}</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.tags.map((tag, i) => (
              <span key={i} className="flex items-center gap-1 px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-sm">
                {tag}
                <button type="button" onClick={() => set("tags", form.tags.filter((_, j) => j !== i))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag + Enter"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (newTag.trim()) { set("tags", [...form.tags, newTag.trim()]); setNewTag(""); }
              }
            }}
          />
        </div>
      </Section>

      {/* Shipping */}
      <Section title={t("shipping")} icon={<span>📦</span>}>
        <div className="grid grid-cols-4 gap-3">
          {(["weight", "length", "width", "height"] as const).map((f) => (
            <div key={f}>
              <Label>{t(f)}</Label>
              <Input type="number" value={form[f]} onChange={(e) => set(f, e.target.value)} dir="ltr" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["hs_code", "material", "origin_country"] as const).map((f) => (
            <div key={f}>
              <Label>{t(f === "hs_code" ? "hsCode" : f === "origin_country" ? "originCountry" : "material")}</Label>
              <Input value={form[f]} onChange={(e) => set(f, e.target.value)} dir="ltr" />
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing */}
      <Section title={t("pricing")} icon={<span>💰</span>} defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("price")}</Label>
            <div className="relative">
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                {form.currency_code || "ILS"}
              </span>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => handlePriceChange(Number(e.target.value))}
                className="ps-12"
                dir="ltr"
                step="1"
                min="0"
              />
            </div>
          </div>
          <div>
            <Label>{t("currency")}</Label>
            <Input
              value={form.currency_code}
              onChange={(e) => set("currency_code", e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3}
              dir="ltr"
              className="font-mono uppercase"
            />
          </div>
        </div>
        {form.hasVariants && form.variants.length > 0 && (
          <p className="text-sm text-brand-600 font-medium">
            {/*{t("priceApplied").replace("{count}", String(form.variants.length))}*/}
          </p>
        )}
      </Section>

      {/* Variants Toggle */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800">{t("hasVariants")} / المنتج له متغيرات</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !form.hasVariants;
              setForm((prev) => ({
                ...prev,
                hasVariants: next,
                options: next ? prev.options : [],
                variants: next ? prev.variants : [],
              }));
            }}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              form.hasVariants ? "bg-brand-600" : "bg-slate-200"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                form.hasVariants ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </div>

      {/* Options */}
      {form.hasVariants && (
        <Section title={t("options")} icon={<span>🎨</span>} defaultOpen>
          {/* Quick Add Presets */}
          <div>
            <Label>{t("quickAdd")}</Label>
            <div className="flex flex-wrap gap-2">
              {OPTION_PRESETS.map((preset) => {
                const already = form.options.some((o) => o.title === preset.optionTitle);
                return (
                  <button
                    key={preset.title}
                    type="button"
                    disabled={already}
                    onClick={() => addOption(preset.optionTitle, preset.values)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                      already
                        ? "border-brand-600 bg-brand-50 text-brand-600 cursor-not-allowed opacity-60"
                        : "border-slate-200 text-slate-600 hover:border-brand-600 hover:text-brand-600"
                    )}
                  >
                    {already && <Check size={10} className="inline me-1" />}
                    {preset.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options list */}
          <div className="space-y-3">
            {form.options.map((opt, optIdx) => (
              <div key={optIdx} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50">
                  <GripVertical size={14} className="text-slate-400 shrink-0" />
                  <span className="flex-1 font-medium text-slate-700 text-sm">{opt.title}</span>
                  <button type="button" onClick={() => removeOption(optIdx)} className="text-slate-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {opt.values.map((val, valIdx) => (
                      <span key={valIdx} className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-full text-xs text-slate-700">
                        {val}
                        <button type="button" onClick={() => removeValueFromOption(optIdx, valIdx)} className="text-slate-400 hover:text-red-500">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newOptionValues[optIdx] || ""}
                      onChange={(e) => setNewOptionValues((p) => ({ ...p, [optIdx]: e.target.value }))}
                      placeholder={t("addValue")}
                      className="text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addValueToOption(optIdx, newOptionValues[optIdx] || "");
                          setNewOptionValues((p) => ({ ...p, [optIdx]: "" }));
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addValueToOption(optIdx, newOptionValues[optIdx] || "");
                        setNewOptionValues((p) => ({ ...p, [optIdx]: "" }));
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add custom option */}
          <div className="flex gap-2">
            <Input
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              placeholder={t("customOption")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newOptionName.trim()) { addOption(newOptionName.trim()); setNewOptionName(""); }
                }
              }}
            />
            <button
              type="button"
              onClick={() => { if (newOptionName.trim()) { addOption(newOptionName.trim()); setNewOptionName(""); } }}
              className="px-4 py-2 btn-brand text-white rounded-xl text-sm font-medium"
            >
              {t("addOption")}
            </button>
          </div>
        </Section>
      )}

      {/* Variants Table */}
      {form.hasVariants && form.variants.length > 0 && (
        <Section title={t("variants")} icon={<span>📋</span>} defaultOpen>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-start py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("variantLabel")}</th>
                  <th className="text-start py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("sku")}</th>
                  <th className="text-start py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("barcode")}</th>
                  <th className="text-start py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("stock")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {form.variants.map((v, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-700">{v.title}</td>
                    <td className="py-2 px-3 font-mono text-slate-500 text-xs">{v.sku}</td>
                    <td className="py-2 px-3 font-mono text-slate-400 text-xs">{v.barcode}</td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        value={v.stock}
                        onChange={(e) => {
                          const newVariants = form.variants.map((vv, vi) =>
                            vi === i ? { ...vv, stock: Number(e.target.value) } : vv
                          );
                          set("variants", newVariants);
                        }}
                        className="w-20 text-xs"
                        dir="ltr"
                        min="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Save */}
      <button
        type="submit"
        disabled={saving}
        className="w-full btn-brand text-white font-semibold py-3 rounded-xl transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {saving && <Loader2 size={18} className="animate-spin" />}
        {saving ? t("saving") : isCreate ? t("createProduct") : t("saveChanges")}
      </button>
    </form>
  );
}

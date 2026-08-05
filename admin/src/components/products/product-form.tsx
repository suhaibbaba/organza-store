"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@shared/constants/languages";
import type { Product } from "@shared/types/product";
import { can } from "@shared/lib/permissions";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { useVariantTypesQuery } from "@/hooks/use-variant-types";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useCreateProductMutation, useUpdateProductMutation, useUpdateVariantMutation, useDeleteVariantMutation } from "@/hooks/use-products";
import { deleteVariant } from "@/lib/api/products";
import {
  productBasicFormSchema,
  DEFAULT_PRODUCT_FORM_VALUES,
  productToFormValues,
  toCreatePayload,
  toUpdatePayload,
  type ProductBasicFormValues,
} from "@/lib/validation/product-form";
import { initVariantEdits, diffVariantEdit } from "@/lib/validation/variant-edit";
import { galleryChanged, initGalleries, pendingCount } from "@/lib/image-slots";
import { syncGallery } from "@/lib/image-sync";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import {
  PRODUCT_GALLERY_KEY,
  variantGalleryKey,
  variantIdFromGalleryKey,
} from "@/constants/images";
import { showNumberedShawlEditor } from "@/lib/validation/numbered-shawl";
import { buildVariantPreview, toOptionSelections, comboKey } from "@/lib/variant-combo";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { LOCALE_LABELS } from "@/constants/locale";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VariantTypePicker } from "@/components/products/variant-type-picker";
import { VariantPreviewList } from "@/components/products/variant-preview-list";
import { VariantEditList } from "@/components/products/variant-edit-list";
import { AddVariantsSection } from "@/components/products/add-variants-section";
import { NumberedShawlEditor } from "@/components/products/numbered-shawl/numbered-shawl-editor";
import { ImageManager } from "@/components/products/image-manager";
import { ApiError } from "@/lib/api/errors";
import type {
  Gallery,
  GallerySlot,
  SaveStep,
  ProductEditAbilities,
  VariantSelectionMap,
  VariantEditValues,
} from "@/types/productForm";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: Product;
}

export function ProductForm({ mode, product }: ProductFormProps) {
  const t = useTranslations("products.form");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useSession();
  const translateError = useTranslateError();

  const canSeeCost = can(user, "product.viewCost");
  const canDeleteImages = can(user, "images.delete");
  const canRemoveCombos = can(user, "product.delete");
  // Editing the details — name, description, category — is open to every
  // role that can edit a product, Employees included. "Edit images" is a
  // separate, broader capability — Employees keep full image access below.
  const canEditDetails = mode === "create" || can(user, "product.edit");
  // Pricing an item is part of adding it, so an Employee still types a price
  // on a NEW product; changing what an existing one sells for is
  // product.editPrice (Admin/Manager). Stock and visibility are gated the
  // same way, each on the permission the backend checks for that field.
  const canEditPrice = mode === "create" || can(user, "product.editPrice");
  const canEditStock = mode === "create" || can(user, "inventory.adjust");
  const showActiveToggle = can(user, "product.hide");
  // Opting a product into low-stock alerts is a stock-management decision,
  // so it follows the stock gate: an Employee who can add or edit a product
  // simply doesn't see the toggle.
  const canTrackLowStock = can(user, "inventory.adjust");

  const abilities: ProductEditAbilities = {
    canEditPrice,
    canEditCost: canSeeCost,
    canEditStock,
    canHide: showActiveToggle,
  };

  const { data: categoryTree } = useCategoriesQuery();
  const categoryOptions = categoryTree ? flattenCategoryTree(categoryTree) : [];
  const { data: variantTypes } = useVariantTypesQuery();
  const { data: settings } = useSettingsQuery();
  const currency = settings?.currency ?? "ILS";

  // Create-mode: which global option values build the cartesian variant set.
  const [selections, setSelections] = useState<VariantSelectionMap>({});
  const [excludedCombos, setExcludedCombos] = useState<Set<string>>(new Set());
  // Edit-mode: local, unsaved edits to the product's existing variant rows.
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantEditValues>>(() =>
    product ? initVariantEdits(product.variants) : {}
  );
  const [removedVariantIds, setRemovedVariantIds] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Every gallery on this screen — the product's, and one per variant — as a
  // working copy plus the server state it is diffed against. Photos are held
  // here, not uploaded on pick, so that one Save writes the product and its
  // photos as a single operation. On a brand-new product the files simply
  // wait here until the product exists to attach them to.
  const [galleries, setGalleries] = useState<Record<string, Gallery>>(() => initGalleries(product));
  // Which part of the save is running, for the one progress line the user
  // sees. Null when idle.
  const [saveStep, setSaveStep] = useState<SaveStep | null>(null);
  // The product saved, some photos didn't. Holds what to say and what a retry
  // would re-attempt; the product id is kept so a retry (or "continue") never
  // creates a second product.
  const [partialFailure, setPartialFailure] = useState<{ pending: number; errorCode: string | null } | null>(null);
  const [savedProductId, setSavedProductId] = useState<string | null>(product?.id ?? null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductBasicFormValues>({
    resolver: zodResolver(productBasicFormSchema),
    defaultValues: mode === "edit" && product ? productToFormValues(product) : DEFAULT_PRODUCT_FORM_VALUES,
  });

  const { productChanged } = useCacheInvalidation();
  const createMutation = useCreateProductMutation();
  const updateMutation = useUpdateProductMutation(product?.id ?? "");
  const updateVariantMutation = useUpdateVariantMutation(product?.id ?? "");
  const deleteVariantMutation = useDeleteVariantMutation(product?.id ?? "");

  const newOptionSelections = toOptionSelections(selections);
  const willHaveVariants = mode === "create" ? newOptionSelections.length > 0 : Boolean(product?.hasVariants);
  const showVariantsCard = mode === "create" || Boolean(product?.hasVariants) || canEditDetails;

  const previewRows = useMemo(
    () => (mode === "create" && variantTypes ? buildVariantPreview(variantTypes, selections) : []),
    [mode, variantTypes, selections]
  );

  function toggleExcludedCombo(key: string) {
    setExcludedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isBusy = isSubmitting || saveStep !== null;
  // Editing photos is its own capability (spec.md), so the one Save button
  // also belongs to someone who may only change those.
  const canSave = canEditDetails || can(user, "images.edit");

  // The per-variant working galleries, in the shape the variant list wants.
  const variantImageSlots = useMemo(() => {
    const map: Record<string, GallerySlot[]> = {};
    for (const [key, gallery] of Object.entries(galleries)) {
      const variantId = variantIdFromGalleryKey(key);
      if (variantId) map[variantId] = gallery.slots;
    }
    return map;
  }, [galleries]);

  function setGallerySlots(key: string, slots: GallerySlot[]) {
    setGalleries((prev) => ({ ...prev, [key]: { slots, saved: prev[key]?.saved ?? [] } }));
  }

  // Writes every gallery that changed, one after another, counting photos
  // through so the progress line can say "3 of 7". Never throws for a photo:
  // failures come back as counts, and whatever failed stays pending in the
  // gallery so a retry picks up exactly those.
  async function saveGalleries(productId: string): Promise<{ pending: number; errorCode: string | null }> {
    const jobs = Object.entries(galleries).filter(([, gallery]) => galleryChanged(gallery));
    if (jobs.length === 0) return { pending: 0, errorCode: null };


    const total = jobs.reduce((sum, [, gallery]) => sum + pendingCount(gallery.slots), 0);
    let uploaded = 0;
    setSaveStep({ kind: "images", done: 0, total });

    const next = { ...galleries };
    let pending = 0;
    let errorCode: string | null = null;

    for (const [key, gallery] of jobs) {
      const variantId = variantIdFromGalleryKey(key);
      const owner = variantId ? { variantId } : { productId };
      const outcome = await syncGallery(owner, gallery, () => {
        uploaded += 1;
        setSaveStep({ kind: "images", done: uploaded, total });
      });
      next[key] = { slots: outcome.slots, saved: outcome.images };
      pending += outcome.pendingCount;
      errorCode ??= outcome.errorCode;
    }

    setGalleries(next);
    return { pending, errorCode };
  }

  // Shared tail of both save and retry: photos are the last step, so this is
  // where the screen either moves on or explains what is still missing.
  function finishSave(productId: string, result: { pending: number; errorCode: string | null }) {
    setSaveStep(null);
    // The last word on what this save changed. The product mutation invalidated
    // when *it* succeeded — before a single photo had gone up — so without this
    // the product page would keep the gallery it was opened with. It runs on a
    // partial failure too: a half-finished upload still added photos.
    productChanged(productId);
    if (result.pending > 0 || result.errorCode) {
      setSavedProductId(productId);
      setPartialFailure({ pending: result.pending, errorCode: result.errorCode });
      return;
    }
    router.push(`/products/${productId}`);
  }

  async function handleRetryImages() {
    if (!savedProductId) return;
    setPartialFailure(null);
    setSubmitError(null);
    try {
      finishSave(savedProductId, await saveGalleries(savedProductId));
    } catch (err) {
      setSaveStep(null);
      setSubmitError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  async function onSubmit(values: ProductBasicFormValues) {
    setSubmitError(null);
    setPartialFailure(null);
    try {
      // One press, three stages, in the only order the API allows: the
      // product row first (a photo needs something to hang on), then the
      // variants, then the photos themselves.
      if (mode === "create") {
        setSaveStep({ kind: "product" });
        const payload = toCreatePayload(values, newOptionSelections);
        const created = await createMutation.mutateAsync(payload);

        if (created.hasVariants && excludedCombos.size > 0) {
          setSaveStep({ kind: "variants" });
          const toDelete = created.variants.filter((v) =>
            excludedCombos.has(comboKey(v.values.map((val) => val.id)))
          );
          await Promise.all(toDelete.map((v) => deleteVariant(created.id, v.id)));
        }

        // The photos picked before the product existed go up now, against the
        // id it was just given — no second trip through the edit screen.
        finishSave(created.id, await saveGalleries(created.id));
        return;
      }

      if (!product) return;

      if (canEditDetails) {
        setSaveStep({ kind: "product" });
        await updateMutation.mutateAsync(toUpdatePayload(values, willHaveVariants, abilities));

        const patches = Object.entries(variantEdits)
          .filter(([id]) => !removedVariantIds.has(id))
          .flatMap(([variantId, edits]) => {
            const original = product.variants.find((v) => v.id === variantId);
            if (!original) return [];
            const patch = diffVariantEdit(original, edits, abilities);
            return patch ? [{ variantId, patch }] : [];
          });

        if (patches.length > 0 || removedVariantIds.size > 0) {
          setSaveStep({ kind: "variants" });
          await Promise.all(
            patches.map(({ variantId, patch }) => updateVariantMutation.mutateAsync({ variantId, input: patch }))
          );
          await Promise.all([...removedVariantIds].map((variantId) => deleteVariantMutation.mutateAsync(variantId)));
        }
      }

      finishSave(product.id, await saveGalleries(product.id));
    } catch (err) {
      setSaveStep(null);
      setSubmitError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pb-6">
      {mode === "edit" && !canEditDetails && product && (
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <p className="text-lg font-semibold text-foreground">{localize(product.name, locale)}</p>
            {product.category && (
              <p className="text-sm text-muted-foreground">{localize(product.category.name, locale)}</p>
            )}
            <p className="text-base font-semibold text-foreground">{formatMoney(product.basePrice, currency, locale)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("employeeReadOnlyHint")}</p>
          </CardContent>
        </Card>
      )}

      {/* Photos are part of the product now, not a follow-up step: they are
          picked here on a brand-new product too, and the Save at the bottom
          uploads them once it exists. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("images.productTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageManager
            slots={galleries[PRODUCT_GALLERY_KEY]?.slots ?? []}
            onChange={(slots) => setGallerySlots(PRODUCT_GALLERY_KEY, slots)}
            canDelete={canDeleteImages}
            isBusy={isBusy}
          />
        </CardContent>
      </Card>

      {canEditDetails && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("basicInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t("name")}</Label>
                <Tabs defaultValue={DEFAULT_LANGUAGE}>
                  <TabsList>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <TabsTrigger key={lang} value={lang}>
                        {LOCALE_LABELS[lang]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <TabsContent key={lang} value={lang}>
                      <Input
                        aria-label={`${t("name")} — ${LOCALE_LABELS[lang]}`}
                        placeholder={lang === DEFAULT_LANGUAGE ? t("required") : t("optional")}
                        aria-invalid={lang === DEFAULT_LANGUAGE && !!errors.name?.ar}
                        {...register(`name.${lang}` as "name.ar")}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
                {errors.name?.ar && (
                  <p className="text-sm text-destructive">{translateError(errors.name.ar.message ?? "")}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{t("description")}</Label>
                <Tabs defaultValue={DEFAULT_LANGUAGE}>
                  <TabsList>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <TabsTrigger key={lang} value={lang}>
                        {LOCALE_LABELS[lang]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <TabsContent key={lang} value={lang}>
                      <Textarea
                        aria-label={`${t("description")} — ${LOCALE_LABELS[lang]}`}
                        placeholder={t("optional")}
                        rows={4}
                        {...register(`description.${lang}` as "description.ar")}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="categoryId">{t("category")}</Label>
                {/* Controller, not register(): categories load async, and a
                    plain uncontrolled select only applies its initial value
                    once — before any matching <option> exists yet — so an
                    edit-mode product's category would render as unselected. */}
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select id="categoryId" aria-invalid={!!errors.categoryId} value={field.value} onChange={field.onChange}>
                      <option value="">{t("selectCategory")}</option>
                      {categoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {"  ".repeat(c.depth)}
                          {localize(c.name, locale)}
                        </option>
                      ))}
                    </Select>
                  )}
                />
                {errors.categoryId && (
                  <p className="text-sm text-destructive">{translateError(errors.categoryId.message ?? "")}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("pricing")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {canEditPrice ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="basePrice">{t("basePrice")}</Label>
                    <NumericInput
                      id="basePrice"
                      allowDecimal
                      aria-invalid={!!errors.basePrice}
                      {...register("basePrice")}
                    />
                    {errors.basePrice && (
                      <p className="text-sm text-destructive">{translateError(errors.basePrice.message ?? "")}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="compareAtPrice">{t("compareAtPrice")}</Label>
                    <NumericInput
                      id="compareAtPrice"
                      allowDecimal
                      placeholder={t("optional")}
                      aria-invalid={!!errors.compareAtPrice}
                      {...register("compareAtPrice")}
                    />
                    {errors.compareAtPrice && (
                      <p className="text-sm text-destructive">{translateError(errors.compareAtPrice.message ?? "")}</p>
                    )}
                  </div>
                </>
              ) : (
                // Shown, not editable: whoever is fixing a name still needs
                // to see what the piece sells for, and hiding the number
                // outright would read as "the price is gone".
                product && (
                  <div className="flex flex-col gap-1">
                    <Label>{t("basePrice")}</Label>
                    <p className="text-base font-semibold text-foreground">
                      {formatMoney(product.basePrice, currency, locale)}
                    </p>
                    <p className="text-sm text-muted-foreground">{t("priceReadOnlyHint")}</p>
                  </div>
                )
              )}

              {canSeeCost && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cost">{t("cost")}</Label>
                  <NumericInput
                    id="cost"
                    allowDecimal
                    placeholder={t("optional")}
                    aria-invalid={!!errors.cost}
                    {...register("cost")}
                  />
                  {errors.cost && <p className="text-sm text-destructive">{translateError(errors.cost.message ?? "")}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {showActiveToggle && (
            <Card>
              <CardContent className="flex items-center justify-between gap-3 py-5">
                <div>
                  <Label htmlFor="isActive">{t("isActive")}</Label>
                  <p className="text-sm text-muted-foreground">{t("isActiveHint")}</p>
                </div>
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Low-stock alerts are opt-in per product (off by default): most
              products are one-off pieces sitting at stock = 1, so a global
              alert would be pure noise. Applies to variant products too, so
              it lives outside the simple-product-only inventory card. */}
          {canTrackLowStock && (
            <Card>
              <CardContent className="flex items-center justify-between gap-3 py-5">
                <div>
                  <Label htmlFor="trackLowStock">{t("trackLowStock")}</Label>
                  <p className="text-sm text-muted-foreground">{t("trackLowStockHint")}</p>
                </div>
                <Controller
                  control={control}
                  name="trackLowStock"
                  render={({ field }) => (
                    <Switch id="trackLowStock" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </CardContent>
            </Card>
          )}

          {!willHaveVariants && (
            <Card>
              <CardHeader>
                <CardTitle>{t("inventory")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {canEditStock && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="stock">{t("stock")}</Label>
                    <NumericInput id="stock" aria-invalid={!!errors.stock} {...register("stock")} />
                    {errors.stock && <p className="text-sm text-destructive">{translateError(errors.stock.message ?? "")}</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="sku">{t("sku")}</Label>
                    <Input id="sku" value={product?.sku ?? t("autoGenerated")} disabled readOnly />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="barcode">{t("barcode")}</Label>
                    <Input id="barcode" value={product?.barcode ?? t("autoGenerated")} disabled readOnly />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {showVariantsCard && (
        <Card>
          <CardHeader>
            <CardTitle>{t("variants.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {mode === "edit" && product?.hasVariants && (
              <VariantEditList
                // Already-placed numbered-shawl points (imageX/imageY set)
                // are edited in the dedicated tool below, not here.
                variants={product.variants.filter((v) => v.imageX == null || v.imageY == null)}
                variantTypes={variantTypes ?? []}
                currency={currency}
                canSeeCost={canSeeCost}
                canEditDetails={canEditDetails}
                canEditPrice={canEditPrice}
                canEditStock={canEditStock}
                canHide={showActiveToggle}
                canRemoveCombos={canRemoveCombos}
                canDeleteImages={canDeleteImages}
                edits={variantEdits}
                onEditChange={(id, v) => setVariantEdits((prev) => ({ ...prev, [id]: v }))}
                imageSlots={variantImageSlots}
                onImageSlotsChange={(variantId, slots) => setGallerySlots(variantGalleryKey(variantId), slots)}
                isSaving={isBusy}
                removedIds={removedVariantIds}
                onRemove={(id) => setRemovedVariantIds((prev) => new Set(prev).add(id))}
                onRestore={(id) =>
                  setRemovedVariantIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  })
                }
              />
            )}

            {mode === "create" && variantTypes && (
              <>
                <VariantTypePicker variantTypes={variantTypes} value={selections} onChange={setSelections} />
                <VariantPreviewList rows={previewRows} excluded={excludedCombos} onToggleExcluded={toggleExcludedCombo} />
              </>
            )}

            {mode === "edit" && product && variantTypes && canEditDetails && (
              <AddVariantsSection productId={product.id} variantTypes={variantTypes} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Numbered shawls (spec.md): a dedicated placement tool, separate
          from the generic variant editor above — reachable once the
          product uses only the Number variant type (or none yet). Each
          placed number carries its own price and stock, so the tool as a
          whole needs those permissions rather than half-working without
          them. */}
      {mode === "edit" && canEditDetails && canEditPrice && canEditStock && product && variantTypes && showNumberedShawlEditor(product) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("numberedShawl.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberedShawlEditor product={product} variantTypes={variantTypes} currency={currency} />
          </CardContent>
        </Card>
      )}

      {submitError && <Alert variant="destructive">{submitError}</Alert>}

      {/* The product is saved and its photos are not: say exactly that, say
          how many are missing, and offer to send just those again. Pressing
          Save again is not on the table — it would file a second product. */}
      {partialFailure ? (
        <Alert variant="destructive">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="font-medium">{t("partial.title")}</p>
              {/* Photos still waiting is the number that matters; a failure
                  with none waiting (the order or main photo didn't stick)
                  gets the plain reason instead of "0 photos". */}
              {partialFailure.pending > 0 ? (
                <p>{t("partial.detail", { count: partialFailure.pending })}</p>
              ) : (
                partialFailure.errorCode && <p>{translateError(partialFailure.errorCode)}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => void handleRetryImages()} disabled={isBusy} className="w-full">
                {isBusy ? (
                  <>
                    <Spinner />
                    {t("partial.retrying")}
                  </>
                ) : (
                  t("partial.retry")
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                className="w-full"
                onClick={() => savedProductId && router.push(`/products/${savedProductId}`)}
              >
                {t("partial.continue")}
              </Button>
            </div>
          </div>
        </Alert>
      ) : (
        canSave && (
          <>
            {/* One button, one progress line — the several calls behind it
                are the app's problem, not the user's. */}
            <Button type="submit" disabled={isBusy} className="w-full">
              {isBusy ? (
                <>
                  <Spinner />
                  {t(mode === "create" ? "creating" : "saving")}
                </>
              ) : (
                t(mode === "create" ? "create" : "save")
              )}
            </Button>
            {saveStep && (
              <p aria-live="polite" className="text-center text-sm text-muted-foreground">
                {saveStep.kind === "images"
                  ? t("progress.images", { done: saveStep.done, total: saveStep.total })
                  : t(saveStep.kind === "product" ? "progress.product" : "progress.variants")}
              </p>
            )}
          </>
        )
      )}
    </form>
  );
}

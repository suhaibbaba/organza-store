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
import { isNumberedShawlEligible } from "@/lib/validation/numbered-shawl";
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
import type { VariantSelectionMap, VariantEditValues } from "@/types/productForm";

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
  const showActiveToggle = mode === "edit" || can(user, "product.hide");
  // Editing product/variant details (name, pricing, stock, generating more
  // variants) is Admin/Manager only (CLAUDE.md rule 5). "Edit images" is a
  // separate, broader capability — Employees keep full image access below.
  const canEditDetails = mode === "create" || can(user, "product.edit");
  const canDeleteImages = can(user, "images.delete");

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

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductBasicFormValues>({
    resolver: zodResolver(productBasicFormSchema),
    defaultValues: mode === "edit" && product ? productToFormValues(product) : DEFAULT_PRODUCT_FORM_VALUES,
  });

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

  const isBusy = isSubmitting || createMutation.isPending || updateMutation.isPending;

  async function onSubmit(values: ProductBasicFormValues) {
    setSubmitError(null);
    try {
      if (mode === "create") {
        const payload = toCreatePayload(values, newOptionSelections);
        const created = await createMutation.mutateAsync(payload);

        if (created.hasVariants && excludedCombos.size > 0) {
          const toDelete = created.variants.filter((v) =>
            excludedCombos.has(comboKey(v.values.map((val) => val.id)))
          );
          await Promise.all(toDelete.map((v) => deleteVariant(created.id, v.id)));
        }

        // Straight to edit, not the read-only detail page — images can only
        // be attached once the product exists, so this is the natural next
        // step (spec.md Part 3b).
        router.push(`/products/${created.id}/edit`);
        return;
      }

      if (!product) return;

      const payload = toUpdatePayload(values, willHaveVariants);
      await updateMutation.mutateAsync(payload);

      const patches = Object.entries(variantEdits)
        .filter(([id]) => !removedVariantIds.has(id))
        .flatMap(([variantId, edits]) => {
          const original = product.variants.find((v) => v.id === variantId);
          if (!original) return [];
          const patch = diffVariantEdit(original, edits);
          return patch ? [{ variantId, patch }] : [];
        });
      await Promise.all(patches.map(({ variantId, patch }) => updateVariantMutation.mutateAsync({ variantId, input: patch })));

      await Promise.all([...removedVariantIds].map((variantId) => deleteVariantMutation.mutateAsync(variantId)));

      router.push(`/products/${product.id}`);
    } catch (err) {
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

      {mode === "edit" && product && (
        <Card>
          <CardHeader>
            <CardTitle>{t("images.productTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageManager owner={{ productId: product.id }} initialImages={product.images} canDelete={canDeleteImages} />
          </CardContent>
        </Card>
      )}

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

          {!willHaveVariants && (
            <Card>
              <CardHeader>
                <CardTitle>{t("inventory")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="stock">{t("stock")}</Label>
                  <NumericInput id="stock" aria-invalid={!!errors.stock} {...register("stock")} />
                  {errors.stock && <p className="text-sm text-destructive">{translateError(errors.stock.message ?? "")}</p>}
                </div>

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
                currency={currency}
                canSeeCost={canSeeCost}
                canEditDetails={canEditDetails}
                canDeleteImages={canDeleteImages}
                edits={variantEdits}
                onEditChange={(id, v) => setVariantEdits((prev) => ({ ...prev, [id]: v }))}
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
          product uses only the Number variant type (or none yet). */}
      {mode === "edit" && canEditDetails && product && variantTypes && isNumberedShawlEligible(product) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("numberedShawl.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <NumberedShawlEditor product={product} variantTypes={variantTypes} currency={currency} />
          </CardContent>
        </Card>
      )}

      {canEditDetails && (
        <>
          {submitError && <Alert variant="destructive">{submitError}</Alert>}

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
        </>
      )}
    </form>
  );
}

"use client";

import { MoneyField } from "@/components/fields/money-field";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button, Input, SaveBar, Section, Select, Switch, TranslatedField } from "@store/ui";
import { PRODUCT_FORM_SECTIONS, type ProductFormSectionName } from "@/constants/products";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@store/shared/constants/languages";
import { NUMBER_VARIANT_TYPE_SLUG } from "@store/shared/constants/variantType";
import { ERROR_CODES } from "@store/shared/constants/errors";
import type { Product } from "@store/shared/types/product";
import { can } from "@store/shared/lib/permissions";
import { fieldErrorTestSelector, fieldTestSelector } from "@store/shared/lib/testSelector";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useCategoriesQuery } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { useVariantTypesQuery } from "@/hooks/use-variant-types";
import { useSettingsQuery } from "@/hooks/use-settings";
import {
  useCreateProductMutation,
  useDeleteVariantMutation,
  useGenerateVariantsMutation,
  useUpdateProductMutation,
  useUpdateVariantMutation,
} from "@/hooks/use-products";
import { DEFAULT_STOCK } from "@store/shared/constants/quantity";
import { deleteVariant } from "@/lib/api/products";
import {
  productBasicFormSchema,
  DEFAULT_PRODUCT_FORM_VALUES,
  productToFormValues,
  toCreatePayload,
  toUpdatePayload,
  type ProductBasicFormValues,
} from "@/lib/validation/product-form";
import { initVariantEdits, diffVariantEdit, variantBarcodeIncomplete } from "@/lib/validation/variant-edit";
import { galleryChanged, initGalleries, pendingCount } from "@/lib/image-slots";
import { syncGallery } from "@/lib/image-sync";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import {
  PRODUCT_GALLERY_KEY,
  variantGalleryKey,
  variantIdFromGalleryKey,
} from "@/constants/images";
import { showNumberedShawlEditor } from "@/lib/validation/numbered-shawl";
import {
  diffOptionValueNotes,
  initOptionValueNotes,
  noteGroupsFromProduct,
  noteGroupsFromSelections,
  setNoteLanguage,
  type OptionValueNoteMap,
} from "@/lib/option-value-notes";
import { buildVariantPreview, toOptionSelections, comboKey } from "@/lib/variant-combo";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { LOCALE_LABELS } from "@/constants/locale";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { parseQuantity } from "@/lib/validation/numeric";
import { OptionValueNotesSection } from "@/components/products/option-value-notes-section";
import { VariantTypePicker } from "@/components/products/variant-type-picker";
import { VariantPreviewList } from "@/components/products/variant-preview-list";
import { VariantEditList } from "@/components/products/variant-edit-list";
import { AddVariantsSection } from "@/components/products/add-variants-section";
import { NumberedShawlEditor } from "@/components/products/numbered-shawl/numbered-shawl-editor";
import { ProductKindChoice } from "@/components/products/product-kind-choice";
import { BarcodeField } from "@/components/products/barcode-field";
import { ImageManager } from "@/components/products/image-manager";
import { ApiError } from "@/lib/api/errors";
import { barcodeConflictSku } from "@/lib/barcode-conflict";
import type {
  Gallery,
  GallerySlot,
  I18nFormValue,
  SaveStep,
  ProductEditAbilities,
  VariantSelectionMap,
  VariantEditValues,
} from "@/types/productForm";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: Product;
  onDiscard?: () => void;
}

export function ProductForm({ mode, product, onDiscard }: ProductFormProps) {
  const t = useTranslations("products.form");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useSession();
  const translateError = useTranslateError();

  const canSeeCost = can(user, "product.viewCost");
  const canRequestChanges = can(user, "changeRequest.create");
  const canDeleteImages = can(user, "images.delete") || canRequestChanges;
  const canRemoveCombos = can(user, "product.editVariantSet") || canRequestChanges;
  const canEditDetails = mode === "create" || can(user, "product.edit");
  const appliesPrice = mode === "create" || can(user, "product.editPrice");
  const appliesStock = mode === "create" || can(user, "inventory.adjust");
  const appliesVisibility = can(user, "product.hide");
  const canEditPrice = appliesPrice || canRequestChanges;
  const canEditStock = appliesStock || canRequestChanges;
  const showActiveToggle = appliesVisibility || canRequestChanges;
  const priceNeedsApproval = !appliesPrice && canRequestChanges;
  const stockNeedsApproval = !appliesStock && canRequestChanges;
  const visibilityNeedsApproval = !appliesVisibility && canRequestChanges;
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

  const [selections, setSelections] = useState<VariantSelectionMap>({});
  const [excludedCombos, setExcludedCombos] = useState<Set<string>>(new Set());
  const [comboStocks, setComboStocks] = useState<Record<string, number>>({});
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantEditValues>>(() =>
    product ? initVariantEdits(product.variants) : {}
  );
  const [variantBaseline, setVariantBaseline] = useState<Record<string, VariantEditValues>>(() =>
    product ? initVariantEdits(product.variants) : {}
  );
  const [removedVariantIds, setRemovedVariantIds] = useState<Set<string>>(new Set());
  const [optionNotes, setOptionNotes] = useState<OptionValueNoteMap>(() => initOptionValueNotes(product));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState(0);

  const [galleries, setGalleries] = useState<Record<string, Gallery>>(() => initGalleries(product));
  const [saveStep, setSaveStep] = useState<SaveStep | null>(null);
  const [partialFailure, setPartialFailure] = useState<{ pending: number; errorCode: string | null } | null>(null);
  const [savedProductId, setSavedProductId] = useState<string | null>(product?.id ?? null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting, isDirty: fieldsDirty },
  } = useForm<ProductBasicFormValues>({
    resolver: zodResolver(productBasicFormSchema),
    defaultValues: mode === "edit" && product ? productToFormValues(product) : DEFAULT_PRODUCT_FORM_VALUES,
  });

  function describeError(err: unknown): string {
    if (!(err instanceof ApiError)) return translateError(ERROR_CODES.INTERNAL);
    const conflict = barcodeConflictSku(err);
    const message = translateError(err.code);
    return conflict ? `${message} ${t("barcode.duplicateConflict", { sku: conflict })}` : message;
  }

  const { productChanged } = useCacheInvalidation();
  const createMutation = useCreateProductMutation();
  const updateMutation = useUpdateProductMutation(product?.id ?? "");
  const updateVariantMutation = useUpdateVariantMutation(product?.id ?? "");
  const deleteVariantMutation = useDeleteVariantMutation(product?.id ?? "");
  const generateMutation = useGenerateVariantsMutation(product?.id ?? "");

  const isNumbered = watch("isNumbered");
  const savedVariantCount = mode === "edit" ? product?.variants.length ?? 0 : 0;
  const kindLockedReason = savedVariantCount === 0 ? null : product?.isNumbered ? "numbers" : "options";

  const newOptionSelections = toOptionSelections(selections);
  const willHaveVariants = mode === "create" ? newOptionSelections.length > 0 : Boolean(product?.hasVariants);
  const showVariantsCard = !isNumbered && (mode === "create" || Boolean(product?.hasVariants) || canEditDetails);

  const ordinaryVariantTypes = useMemo(
    () => (variantTypes ?? []).filter((type) => type.slug !== NUMBER_VARIANT_TYPE_SLUG),
    [variantTypes]
  );

  const noteGroups = useMemo(
    () =>
      mode === "create"
        ? noteGroupsFromSelections(variantTypes ?? [], selections, locale)
        : product
          ? noteGroupsFromProduct(product, locale)
          : [],
    [mode, variantTypes, selections, product, locale]
  );

  const noteRowKeys = useMemo(
    () => new Set(noteGroups.flatMap((group) => group.rows.map((row) => row.key))),
    [noteGroups]
  );
  const chosenValueNotes = (initial: OptionValueNoteMap) =>
    diffOptionValueNotes(initial, optionNotes, (key) => (noteRowKeys.has(key) ? key : null));

  function handleNoteChange(key: string, language: keyof I18nFormValue, text: string) {
    setOptionNotes((previous) => setNoteLanguage(previous, key, language, text));
  }

  const previewRows = useMemo(
    () => buildVariantPreview(ordinaryVariantTypes, selections),
    [ordinaryVariantTypes, selections]
  );
  const comboStocksPayload = previewRows
    .filter((row) => !excludedCombos.has(row.key))
    .map((row) => ({ valueIds: row.valueIds, stock: comboStocks[row.key] ?? DEFAULT_STOCK }));

  function setComboStock(key: string, stock: number) {
    setComboStocks((previous) => ({ ...previous, [key]: stock }));
  }

  function toggleExcludedCombo(key: string) {
    setExcludedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isBusy = isSubmitting || saveStep !== null;
  const languageOrder: (keyof I18nFormValue)[] = [
    DEFAULT_LANGUAGE,
    ...SUPPORTED_LANGUAGES.filter((lang) => lang !== DEFAULT_LANGUAGE),
  ];
  const formLanguages = languageOrder.map((code) => ({ code, name: LOCALE_LABELS[code] }));
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const hasChanges =
    fieldsDirty ||
    Object.values(galleries).some(galleryChanged) ||
    removedVariantIds.size > 0 ||
    JSON.stringify(variantEdits) !== JSON.stringify(variantBaseline) ||
    chosenValueNotes(initOptionValueNotes(product)).length > 0 ||
    newOptionSelections.length > 0;
  useEffect(() => {
    if (submitError || partialFailure || awaitingApproval > 0) {
      noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [submitError, partialFailure, awaitingApproval]);
  const canSave = canEditDetails || can(user, "images.edit");

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

  async function saveGalleries(
    productId: string
  ): Promise<{ pending: number; awaiting: number; errorCode: string | null }> {
    const jobs = Object.entries(galleries).filter(([, gallery]) => galleryChanged(gallery));
    if (jobs.length === 0) return { pending: 0, awaiting: 0, errorCode: null };

    const total = jobs.reduce((sum, [, gallery]) => sum + pendingCount(gallery.slots), 0);
    let uploaded = 0;
    setSaveStep({ kind: "images", done: 0, total });

    const next = { ...galleries };
    let pending = 0;
    let errorCode: string | null = null;
    let awaiting = 0;

    for (const [key, gallery] of jobs) {
      const variantId = variantIdFromGalleryKey(key);
      const owner = variantId ? { variantId } : { productId };
      const outcome = await syncGallery(owner, gallery, () => {
        uploaded += 1;
        setSaveStep({ kind: "images", done: uploaded, total });
      });
      next[key] = { slots: outcome.slots, saved: outcome.images };
      pending += outcome.pendingCount;
      awaiting += outcome.awaitingApproval;
      errorCode ??= outcome.errorCode;
    }

    setGalleries(next);
    return { pending, awaiting, errorCode };
  }

  function finishSave(
    productId: string,
    result: { pending: number; awaiting: number; errorCode: string | null },
    requestsFiled = 0
  ) {
    setSaveStep(null);
    const waiting = requestsFiled + result.awaiting;
    setAwaitingApproval(waiting);
    productChanged(productId);
    if (result.pending > 0 || result.errorCode) {
      setSavedProductId(productId);
      setPartialFailure({ pending: result.pending, errorCode: result.errorCode });
      return;
    }
    if (waiting > 0) {
      setSavedProductId(productId);
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
      setSubmitError(describeError(err));
    }
  }

  async function onSubmit(values: ProductBasicFormValues) {
    setSubmitError(null);
    setPartialFailure(null);

    const liveVariantEdits = Object.entries(variantEdits)
      .filter(([id]) => !removedVariantIds.has(id))
      .map(([, edits]) => edits);
    if (liveVariantEdits.some(variantBarcodeIncomplete)) {
      setSubmitError(translateError(ERROR_CODES.BARCODE_INVALID));
      return;
    }

    try {
      if (mode === "create") {
        setSaveStep({ kind: "product" });
        const payload = {
          ...toCreatePayload(values, newOptionSelections, chosenValueNotes({})),
          comboStocks: comboStocksPayload,
        };
        const created = await createMutation.mutateAsync(payload);

        if (created.hasVariants && excludedCombos.size > 0) {
          setSaveStep({ kind: "variants" });
          const toDelete = created.variants.filter((v) =>
            excludedCombos.has(comboKey(v.values.map((val) => val.id)))
          );
          await Promise.all(toDelete.map((v) => deleteVariant(created.id, v.id)));
        }

        finishSave(created.id, await saveGalleries(created.id));
        return;
      }

      if (!product) return;

      const filedRequests = new Set<string>();

      if (canEditDetails) {
        setSaveStep({ kind: "product" });
        const saved = await updateMutation.mutateAsync(
          toUpdatePayload(
            values,
            willHaveVariants,
            abilities,
            chosenValueNotes(initOptionValueNotes(product))
          )
        );
        for (const change of saved.pendingChanges ?? []) filedRequests.add(change.id);

        const patches = Object.entries(variantEdits)
          .filter(([id]) => !removedVariantIds.has(id))
          .flatMap(([variantId, edits]) => {
            const original = product.variants.find((v) => v.id === variantId);
            if (!original) return [];
            const patch = diffVariantEdit(original, edits, abilities, variantBaseline[variantId]);
            return patch ? [{ variantId, patch }] : [];
          });

        if (patches.length > 0 || removedVariantIds.size > 0) {
          setSaveStep({ kind: "variants" });
          const patched = await Promise.all(
            patches.map(({ variantId, patch }) => updateVariantMutation.mutateAsync({ variantId, input: patch }))
          );
          for (const variant of patched) {
            for (const change of variant.pendingChanges ?? []) filedRequests.add(change.id);
          }
          setVariantBaseline(variantEdits);
          const removals = await Promise.all(
            [...removedVariantIds].map((variantId) => deleteVariantMutation.mutateAsync(variantId))
          );
          for (const removal of removals) {
            if (removal.pendingChange) filedRequests.add(removal.pendingChange.id);
          }
        }
      }

      const galleryResult = await saveGalleries(product.id);

      if (canEditDetails && newOptionSelections.length > 0) {
        setSaveStep({ kind: "variants" });
        const existingIds = new Set(product.variants.map((variant) => variant.id));
        const generated = await generateMutation.mutateAsync({
          optionSelections: newOptionSelections,
          comboStocks: comboStocksPayload,
        });
        for (const change of generated.pendingChanges ?? []) filedRequests.add(change.id);
        const unwanted = generated.variants.filter(
          (variant) =>
            !existingIds.has(variant.id) && excludedCombos.has(comboKey(variant.values.map((value) => value.id)))
        );
        await Promise.all(unwanted.map((variant) => deleteVariantMutation.mutateAsync(variant.id)));
      }

      finishSave(product.id, galleryResult, filedRequests.size);
    } catch (err) {
      setSaveStep(null);
      setSubmitError(describeError(err));
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div ref={noticeRef} className="flex flex-col gap-3 empty:hidden">
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {awaitingApproval > 0 && savedProductId && (
        <Alert tone="info" title={t("awaitingApproval.title")}>
          <div className="flex flex-col gap-3">
            <p>{t("awaitingApproval.detail", { count: awaitingApproval })}</p>
            <Button className="w-full sm:w-auto sm:self-start" onClick={() => router.push(`/products/${savedProductId}`)}>
              {t("awaitingApproval.viewProduct")}
            </Button>
          </div>
        </Alert>
      )}
        {partialFailure && (
        <Alert tone="danger" title={t("partial.title")}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              {partialFailure.pending > 0 ? (
                <p>{t("partial.detail", { count: partialFailure.pending })}</p>
              ) : (
                partialFailure.errorCode && <p>{translateError(partialFailure.errorCode)}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => void handleRetryImages()} isLoading={isBusy} className="w-full sm:w-auto sm:self-start">
                {isBusy ? t("partial.retrying") : t("partial.retry")}
              </Button>
              <Button
                variant="secondary"
                disabled={isBusy}
                className="w-full sm:w-auto sm:self-start"
                onClick={() => savedProductId && router.push(`/products/${savedProductId}`)}
              >
                {t("partial.continue")}
              </Button>
            </div>
          </div>
        </Alert>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
      {mode === "edit" && !canEditDetails && product && (
        <section data-test-selector="product-form-read-only" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
          <div className="flex flex-col gap-1">
            <p className="text-heading font-semibold text-ink">{localize(product.name, locale)}</p>
            {product.category && (
              <p className="text-label text-ink-muted">{localize(product.category.name, locale)}</p>
            )}
            <p className="text-value font-semibold text-ink">{formatMoney(product.basePrice, currency, locale)}</p>
            <p className="mt-2 text-label text-ink-muted">{t("employeeReadOnlyHint")}</p>
          </div>
        </section>
      )}

          {canEditDetails && (
            <>
              <FormSection name="basic-info" title={t("basicInfo")} forceOpen={!!errors.name || !!errors.categoryId}>
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 text-label text-ink">{t("name")}</legend>
                  <TranslatedField
                    data-testid="translated-name"
                    languages={formLanguages}
                    values={watch("name")}
                    hasError={!!errors.name?.ar}
                    controlProps={(lang) => ({
                      "data-test-selector": `field-name-${lang}`,
                      "aria-label": `${t("name")} — ${LOCALE_LABELS[lang as keyof I18nFormValue]}`,
                      placeholder: lang === DEFAULT_LANGUAGE ? t("required") : t("optional"),
                      ...register(`name.${lang}` as "name.ar"),
                    })}
                  />
                  {errors.name?.ar && (
                    <FieldErrorText field="name">{translateError(errors.name.ar.message ?? "")}</FieldErrorText>
                  )}
                </fieldset>

                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 text-label text-ink">{t("description")}</legend>
                  <TranslatedField
                    data-testid="translated-description"
                    multiline
                    languages={formLanguages}
                    values={watch("description")}
                    controlProps={(lang) => ({
                      "data-test-selector": `field-description-${lang}`,
                      "aria-label": `${t("description")} — ${LOCALE_LABELS[lang as keyof I18nFormValue]}`,
                      placeholder: t("optional"),
                      ...register(`description.${lang}` as "description.ar"),
                    })}
                  />
                </fieldset>

                <div className="flex flex-col gap-2">
                  <label htmlFor="categoryId" className="text-label text-ink">
                    {t("category")}
                  </label>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select
                      id="categoryId"
                      data-testid={fieldTestSelector("categoryId")}
                      hasError={!!errors.categoryId}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                      onBlur={field.onBlur}
                      placeholder={t("selectCategory")}
                      options={categoryOptions.map((c) => ({
                        value: c.id,
                        label: `${"  ".repeat(c.depth)}${localize(c.name, locale)}`,
                      }))}
                    />
                  )}
                />
                {errors.categoryId && (
                  <FieldErrorText field="categoryId">{translateError(errors.categoryId.message ?? "")}</FieldErrorText>
                )}
                </div>
              </FormSection>

              <FormSection name="pricing" title={t("pricing")} forceOpen={!!errors.basePrice || !!errors.compareAtPrice || !!errors.cost}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {canEditPrice ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="basePrice" className="text-label text-ink">
                      {t("basePrice")}
                    </label>
                    <MoneyField
                      id="basePrice"
                      aria-invalid={!!errors.basePrice}
                      {...register("basePrice")}
                    />
                    {errors.basePrice && (
                      <FieldErrorText field="basePrice">{translateError(errors.basePrice.message ?? "")}</FieldErrorText>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="compareAtPrice" className="text-label text-ink">
                      {t("compareAtPrice")}
                    </label>
                    <MoneyField
                      id="compareAtPrice"
                      placeholder={t("optional")}
                      aria-invalid={!!errors.compareAtPrice}
                      {...register("compareAtPrice")}
                    />
                    {errors.compareAtPrice && (
                      <FieldErrorText field="compareAtPrice">{translateError(errors.compareAtPrice.message ?? "")}</FieldErrorText>
                    )}
                  </div>

                  {priceNeedsApproval && (
                    <p className="text-label text-ink-muted">{t("needsApproval.price")}</p>
                  )}
                </>
              ) : (
                product && (
                  <div className="flex flex-col gap-1">
                    <span className="text-label text-ink">{t("basePrice")}</span>
                    <p className="text-value font-semibold text-ink">
                      {formatMoney(product.basePrice, currency, locale)}
                    </p>
                    <p className="text-label text-ink-muted">{t("priceReadOnlyHint")}</p>
                  </div>
                )
              )}
              {canSeeCost && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="cost" className="text-label text-ink">
                    {t("cost")}
                  </label>
                  <MoneyField
                    id="cost"
                    placeholder={t("optional")}
                    aria-invalid={!!errors.cost}
                    {...register("cost")}
                  />
                  {errors.cost && <FieldErrorText field="cost">{translateError(errors.cost.message ?? "")}</FieldErrorText>}
                </div>
              )}
                </div>
              </FormSection>

            </>
          )}

          <FormSection name="photos" title={t("images.productTitle")}>
          <ImageManager
            slots={galleries[PRODUCT_GALLERY_KEY]?.slots ?? []}
            onChange={(slots) => setGallerySlots(PRODUCT_GALLERY_KEY, slots)}
            canDelete={canDeleteImages}
            isBusy={isBusy}
          />
          </FormSection>

          {showVariantsCard && (
            <FormSection name="variants" title={t("variants.title")}>
          <div className="flex flex-col gap-4">
            {mode === "edit" && product?.hasVariants && (
              <VariantEditList
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
                <VariantTypePicker variantTypes={ordinaryVariantTypes} value={selections} onChange={setSelections} />
                <VariantPreviewList
                  rows={previewRows}
                  excluded={excludedCombos}
                  onToggleExcluded={toggleExcludedCombo}
                  stocks={comboStocks}
                  onStockChange={setComboStock}
                />
              </>
            )}

            {mode === "edit" && product && variantTypes && canEditDetails && (
              <AddVariantsSection
                variantTypes={ordinaryVariantTypes}
                selections={selections}
                onSelectionsChange={setSelections}
                excluded={excludedCombos}
                onToggleExcluded={toggleExcludedCombo}
                stocks={comboStocks}
                {...(canEditStock && { onStockChange: setComboStock })}
              />
            )}

            {canEditDetails && (
              <OptionValueNotesSection
                groups={noteGroups}
                notes={optionNotes}
                onChange={handleNoteChange}
                disabled={isBusy}
                hint={mode === "create" ? t("optionNotes.createHint") : undefined}
              />
            )}
          </div>
            </FormSection>
          )}

      {isNumbered && canEditDetails && (mode === "create" || !product?.isNumbered) && (
        <FormSection name="numbered-hint" title={t("numberedShawl.title")}>
          <div>
            <p className="text-label text-ink-muted">{t("kind.placeNumbersAfterSave")}</p>
          </div>
        </FormSection>
      )}

      {mode === "edit" && canEditDetails && canEditPrice && canEditStock && product && variantTypes && isNumbered && showNumberedShawlEditor(product) && (
        <FormSection name="numbered-shawl" title={t("numberedShawl.title")}>
          <div>
            <NumberedShawlEditor product={product} variantTypes={variantTypes} currency={currency} />
          </div>
        </FormSection>
      )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {canEditDetails && (showActiveToggle || canTrackLowStock) && (
            <FormSection name="status" title={t("statusTitle")}>
              <div className="flex flex-col divide-y divide-line">
          {showActiveToggle && (
            <div className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="isActive" className="text-label text-ink">
                    {t("isActive")}
                  </label>
                  <p className="text-label text-ink-muted">
                    {visibilityNeedsApproval ? t("needsApproval.visibility") : t("isActiveHint")}
                  </p>
                </div>
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch
                      id="isActive"
                      data-testid={fieldTestSelector("isActive")}
                      label={t("isActive")}
                      hideLabel
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
          )}
          {canTrackLowStock && (
            <div className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="trackLowStock" className="text-label text-ink">
                    {t("trackLowStock")}
                  </label>
                  <p className="text-label text-ink-muted">{t("trackLowStockHint")}</p>
                </div>
                <Controller
                  control={control}
                  name="trackLowStock"
                  render={({ field }) => (
                    <Switch
                      id="trackLowStock"
                      data-testid={fieldTestSelector("trackLowStock")}
                      label={t("trackLowStock")}
                      hideLabel
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
          )}
              </div>
            </FormSection>
          )}

          {canEditDetails && (
            <FormSection name="kind" title={t("kind.title")}>
            <Controller
              control={control}
              name="isNumbered"
              render={({ field }) => (
                <ProductKindChoice
                  value={field.value}
                  onChange={field.onChange}
                  lockedReason={kindLockedReason}
                  disabled={isBusy}
                />
              )}
            />
            </FormSection>
          )}

          {/* Shown for variant products too: one supplier code on the parent opens the POS variant picker (rule 13). */}
          {canEditDetails && (
            <FormSection name="barcode" title={t("barcode.title")} forceOpen={!!errors.barcode}>
              <div className="flex flex-col gap-3">
                <Controller
                  control={control}
                  name="barcodeSource"
                  render={({ field: sourceField }) => (
                    <Controller
                      control={control}
                      name="barcode"
                      render={({ field: codeField }) => (
                        <BarcodeField
                          id="product-barcode"
                          source={sourceField.value}
                          value={codeField.value}
                          onChange={({ source, value }) => {
                            sourceField.onChange(source);
                            codeField.onChange(value);
                          }}
                          currentCode={product?.barcode ?? null}
                          disabled={isBusy}
                        />
                      )}
                    />
                  )}
                />
                {errors.barcode && (
                  <FieldErrorText field="product-barcode">{translateError(errors.barcode.message ?? "")}</FieldErrorText>
                )}
                {willHaveVariants && <p className="text-label text-ink-muted">{t("barcode.parentSharedHint")}</p>}
              </div>
            </FormSection>
          )}

          {canEditDetails && (
            <>
          {!willHaveVariants && (
            <FormSection name="inventory" title={t("inventory")} forceOpen={!!errors.stock}>
              <div className="flex flex-col gap-4">
                {isNumbered && <p className="text-label text-ink-muted">{t("kind.stockPerNumber")}</p>}
                {canEditStock && !isNumbered && (
                  <div className="flex flex-col gap-2">
                    <span className="text-label text-ink">{t("stock")}</span>
                    <Controller
                      control={control}
                      name="stock"
                      render={({ field }) => (
                        <QuantityStepper
                          value={parseQuantity(field.value)}
                          onChange={(quantity) => field.onChange(String(quantity))}
                          decreaseLabel={tCommon("quantity.decrease", { name: t("stock") })}
                          increaseLabel={tCommon("quantity.increase", { name: t("stock") })}
                          valueLabel={tCommon("quantity.value", { name: t("stock") })}
                        />
                      )}
                    />
                    {errors.stock && <FieldErrorText field="stock">{translateError(errors.stock.message ?? "")}</FieldErrorText>}
                    {stockNeedsApproval && (
                      <p className="text-label text-ink-muted">{t("needsApproval.stock")}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sku" className="text-label text-ink">
                    {t("sku")}
                  </label>
                  <Input id="sku" data-test-selector={fieldTestSelector("sku")} value={product?.sku ?? t("autoGenerated")} disabled readOnly />
                </div>
              </div>
            </FormSection>
          )}
            </>
          )}
        </div>
      </div>

      {canSave && !partialFailure && (
        <SaveBar
          data-testid="product-save"
          visible={mode === "create" || hasChanges || isBusy}
          saving={isBusy}
          message={
            saveStep
              ? saveStep.kind === "images"
                ? t("progress.images", { done: saveStep.done, total: saveStep.total })
                : t(saveStep.kind === "product" ? "progress.product" : "progress.variants")
              : undefined
          }
          onSave={() => void handleSubmit(onSubmit)()}
          onDiscard={() => (onDiscard ? onDiscard() : router.push(product ? `/products/${product.id}` : "/products"))}
        />
      )}
    </form>
  );
}

function FieldErrorText({ field, children }: { field: string; children: ReactNode }) {
  return (
    <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector(field)}>
      {children}
    </p>
  );
}

function FormSection({
  name,
  title,
  forceOpen,
  children,
}: {
  name: ProductFormSectionName;
  title: string;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("products.form.sections");
  const { icon, tone } = PRODUCT_FORM_SECTIONS[name];
  return (
    <Section
      data-testid={`product-form-${name}`}
      title={title}
      description={t(name)}
      icon={icon}
      tone={tone}
      collapsible
      forceOpen={forceOpen}
    >
      {children}
    </Section>
  );
}


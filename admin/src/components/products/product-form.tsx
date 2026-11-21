"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button, Card, Input, SegmentedControl, Select, Switch, Textarea } from "@store/ui";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@organza/shared/constants/languages";
import { NUMBER_VARIANT_TYPE_SLUG } from "@organza/shared/constants/variantType";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import type { Product } from "@organza/shared/types/product";
import { can } from "@organza/shared/lib/permissions";
import { fieldErrorTestSelector, fieldTestSelector } from "@organza/shared/lib/testSelector";
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
import { FormContainer } from "@/components/layout/form-container";
import { NumericInput } from "@/components/fields/numeric-input";
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
}

export function ProductForm({ mode, product }: ProductFormProps) {
  const t = useTranslations("products.form");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useSession();
  const translateError = useTranslateError();

  const canSeeCost = can(user, "product.viewCost");
  // Someone who may only REQUEST still sees the fields: a field you can't see is a change you can't ask for (spec.md "Employee change approvals").
  const canRequestChanges = can(user, "changeRequest.create");
  const canDeleteImages = can(user, "images.delete") || canRequestChanges;
  const canRemoveCombos = can(user, "product.editVariantSet") || canRequestChanges;
  // Details are open to every editing role; images are a separate, broader capability.
  const canEditDetails = mode === "create" || can(user, "product.edit");
  // A NEW product's price is part of adding it; re-pricing an existing one is product.editPrice.
  const appliesPrice = mode === "create" || can(user, "product.editPrice");
  const appliesStock = mode === "create" || can(user, "inventory.adjust");
  const appliesVisibility = can(user, "product.hide");
  // The backend decides on save whether a value lands or waits; the hint says which.
  const canEditPrice = appliesPrice || canRequestChanges;
  const canEditStock = appliesStock || canRequestChanges;
  const showActiveToggle = appliesVisibility || canRequestChanges;
  // ...and the little "this needs approval" line beneath each of them.
  const priceNeedsApproval = !appliesPrice && canRequestChanges;
  const stockNeedsApproval = !appliesStock && canRequestChanges;
  const visibilityNeedsApproval = !appliesVisibility && canRequestChanges;
  // Low-stock opt-in follows the stock gate.
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
  const [nameLanguage, setNameLanguage] = useState<keyof I18nFormValue>(DEFAULT_LANGUAGE);
  const [descriptionLanguage, setDescriptionLanguage] = useState<keyof I18nFormValue>(DEFAULT_LANGUAGE);
  const [selections, setSelections] = useState<VariantSelectionMap>({});
  const [excludedCombos, setExcludedCombos] = useState<Set<string>>(new Set());
  // Edit-mode: local, unsaved edits to the product's existing variant rows.
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantEditValues>>(() =>
    product ? initVariantEdits(product.variants) : {}
  );
  // Baseline separating what the person changed from what changed elsewhere (diffVariantEdit).
  const [variantBaseline, setVariantBaseline] = useState<Record<string, VariantEditValues>>(() =>
    product ? initVariantEdits(product.variants) : {}
  );
  const [removedVariantIds, setRemovedVariantIds] = useState<Set<string>>(new Set());
  // Keyed by option value id, saved with the rest of the form (spec.md "Notes on a product's options").
  const [optionNotes, setOptionNotes] = useState<OptionValueNoteMap>(() => initOptionValueNotes(product));
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Held changes are reported as news, never as an error: nothing failed.
  const [awaitingApproval, setAwaitingApproval] = useState(0);

  // Photos are held here, not uploaded on pick, so one Save writes the product and its photos together.
  const [galleries, setGalleries] = useState<Record<string, Gallery>>(() => initGalleries(product));
  // Null when idle.
  const [saveStep, setSaveStep] = useState<SaveStep | null>(null);
  // Keeps the product id so a retry (or "continue") never creates a second product.
  const [partialFailure, setPartialFailure] = useState<{ pending: number; errorCode: string | null } | null>(null);
  const [savedProductId, setSavedProductId] = useState<string | null>(product?.id ?? null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductBasicFormValues>({
    resolver: zodResolver(productBasicFormSchema),
    defaultValues: mode === "edit" && product ? productToFormValues(product) : DEFAULT_PRODUCT_FORM_VALUES,
  });

  // A rejected barcode also names the piece already using it (lib/barcode-conflict.ts).
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

  // A numbered product sells its numbers only, so the colour/size machinery isn't shown (spec.md "Numbered shawls").
  const isNumbered = watch("isNumbered");
  // Locked while variants exist; the API refuses it too.
  const savedVariantCount = mode === "edit" ? product?.variants.length ?? 0 : 0;
  const kindLockedReason = savedVariantCount === 0 ? null : product?.isNumbered ? "numbers" : "options";

  const newOptionSelections = toOptionSelections(selections);
  const willHaveVariants = mode === "create" ? newOptionSelections.length > 0 : Boolean(product?.hasVariants);
  const showVariantsCard = !isNumbered && (mode === "create" || Boolean(product?.hasVariants) || canEditDetails);

  // Numbers are placed by the dedicated tool, never in the colour/size picker.
  const ordinaryVariantTypes = useMemo(
    () => (variantTypes ?? []).filter((type) => type.slug !== NUMBER_VARIANT_TYPE_SLUG),
    [variantTypes]
  );

  // Just-ticked values while creating, or the ones the variants already use.
  const noteGroups = useMemo(
    () =>
      mode === "create"
        ? noteGroupsFromSelections(variantTypes ?? [], selections, locale)
        : product
          ? noteGroupsFromProduct(product, locale)
          : [],
    [mode, variantTypes, selections, product, locale]
  );

  // Notes on unticked values are dropped from the payload (the API refuses them) but kept locally for a re-tick.
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
    () => (mode === "create" ? buildVariantPreview(ordinaryVariantTypes, selections) : []),
    [mode, ordinaryVariantTypes, selections]
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
  // Image editing is its own capability, so Save also belongs to someone who may only change photos.
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

  // Never throws for a photo: failures come back as counts and stay pending for a retry.
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
    // Photo deletions that were filed as requests rather than carried out.
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
    // The product mutation invalidated before any photo went up, so invalidate again, even on partial failure.
    productChanged(productId);
    if (result.pending > 0 || result.errorCode) {
      setSavedProductId(productId);
      setPartialFailure({ pending: result.pending, errorCode: result.errorCode });
      return;
    }
    // A HELD change keeps the form on screen: leaving would look like a normal save (spec.md "Employee change approvals").
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

    // A half-scanned supplier code blocks Save rather than silently dropping it; rows staged for removal are exempt.
    const liveVariantEdits = Object.entries(variantEdits)
      .filter(([id]) => !removedVariantIds.has(id))
      .map(([, edits]) => edits);
    if (liveVariantEdits.some(variantBarcodeIncomplete)) {
      setSubmitError(translateError(ERROR_CODES.BARCODE_INVALID));
      return;
    }

    try {
      // Product row, then variants, then photos: the only order the API allows.
      if (mode === "create") {
        setSaveStep({ kind: "product" });
        const payload = toCreatePayload(values, newOptionSelections, chosenValueNotes({}));
        const created = await createMutation.mutateAsync(payload);

        if (created.hasVariants && excludedCombos.size > 0) {
          setSaveStep({ kind: "variants" });
          const toDelete = created.variants.filter((v) =>
            excludedCombos.has(comboKey(v.values.map((val) => val.id)))
          );
          await Promise.all(toDelete.map((v) => deleteVariant(created.id, v.id)));
        }

        // Photos picked before the product existed go up against its new id.
        finishSave(created.id, await saveGalleries(created.id));
        return;
      }

      if (!product) return;

      // Collected by request id so the notice can say how many are waiting.
      const filedRequests = new Set<string>();

      if (canEditDetails) {
        setSaveStep({ kind: "product" });
        const saved = await updateMutation.mutateAsync(
          toUpdatePayload(
            values,
            willHaveVariants,
            abilities,
            // Only changed notes, so a save never overwrites one written elsewhere since.
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
          // The new baseline, so a second save doesn't resend these over a later change.
          setVariantBaseline(variantEdits);
          const removals = await Promise.all(
            [...removedVariantIds].map((variantId) => deleteVariantMutation.mutateAsync(variantId))
          );
          for (const removal of removals) {
            if (removal.pendingChange) filedRequests.add(removal.pendingChange.id);
          }
        }
      }

      finishSave(product.id, await saveGalleries(product.id), filedRequests.size);
    } catch (err) {
      setSaveStep(null);
      setSubmitError(describeError(err));
    }
  }

  return (
    <FormContainer asForm onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pb-6">
      {mode === "edit" && !canEditDetails && product && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-heading font-semibold text-ink">{localize(product.name, locale)}</p>
            {product.category && (
              <p className="text-label text-ink-muted">{localize(product.category.name, locale)}</p>
            )}
            <p className="text-value font-semibold text-ink">{formatMoney(product.basePrice, currency, locale)}</p>
            <p className="mt-2 text-label text-ink-muted">{t("employeeReadOnlyHint")}</p>
          </div>
        </Card>
      )}

      {canEditDetails && (
        <Card className="flex flex-col gap-4">
          <h3 className="text-section font-semibold text-ink">{t("kind.title")}</h3>
          <div>
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
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h3 className="text-section font-semibold text-ink">{t("images.productTitle")}</h3>
        <div>
          <ImageManager
            slots={galleries[PRODUCT_GALLERY_KEY]?.slots ?? []}
            onChange={(slots) => setGallerySlots(PRODUCT_GALLERY_KEY, slots)}
            canDelete={canDeleteImages}
            isBusy={isBusy}
          />
        </div>
      </Card>

      {canEditDetails && (
        <>
          <Card className="flex flex-col gap-4">
            <h3 className="text-section font-semibold text-ink">{t("basicInfo")}</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-label font-medium text-ink">{t("name")}</span>
                <SegmentedControl
                  label={tCommon("language")}
                  size="sm"
                  value={nameLanguage}
                  onChange={setNameLanguage}
                  options={SUPPORTED_LANGUAGES.map((lang) => ({ value: lang, label: LOCALE_LABELS[lang] }))}
                />
                <Input
                  key={nameLanguage}
                  data-test-selector={`field-name-${nameLanguage}`}
                  aria-label={`${t("name")} — ${LOCALE_LABELS[nameLanguage]}`}
                  placeholder={nameLanguage === DEFAULT_LANGUAGE ? t("required") : t("optional")}
                  hasError={nameLanguage === DEFAULT_LANGUAGE && !!errors.name?.ar}
                  {...register(`name.${nameLanguage}` as "name.ar")}
                />
                {errors.name?.ar && (
                  <FieldErrorText field="name">{translateError(errors.name.ar.message ?? "")}</FieldErrorText>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-label font-medium text-ink">{t("description")}</span>
                <SegmentedControl
                  label={tCommon("language")}
                  size="sm"
                  value={descriptionLanguage}
                  onChange={setDescriptionLanguage}
                  options={SUPPORTED_LANGUAGES.map((lang) => ({ value: lang, label: LOCALE_LABELS[lang] }))}
                />
                <Textarea
                  key={descriptionLanguage}
                  data-test-selector={`field-description-${descriptionLanguage}`}
                  aria-label={`${t("description")} — ${LOCALE_LABELS[descriptionLanguage]}`}
                  placeholder={t("optional")}
                  rows={4}
                  {...register(`description.${descriptionLanguage}` as "description.ar")}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="categoryId" className="text-label font-medium text-ink">
                  {t("category")}
                </label>
                {/* Controller, not register(): categories load async, so an uncontrolled select would miss its initial value. */}
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
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <h3 className="text-section font-semibold text-ink">{t("pricing")}</h3>
            <div className="flex flex-col gap-4">
              {canEditPrice ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="basePrice" className="text-label font-medium text-ink">
                      {t("basePrice")}
                    </label>
                    <NumericInput
                      id="basePrice"
                      allowDecimal
                      aria-invalid={!!errors.basePrice}
                      {...register("basePrice")}
                    />
                    {errors.basePrice && (
                      <FieldErrorText field="basePrice">{translateError(errors.basePrice.message ?? "")}</FieldErrorText>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="compareAtPrice" className="text-label font-medium text-ink">
                      {t("compareAtPrice")}
                    </label>
                    <NumericInput
                      id="compareAtPrice"
                      allowDecimal
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
                // Shown read-only: hiding it would read as "the price is gone".
                product && (
                  <div className="flex flex-col gap-1">
                    <span className="text-label font-medium text-ink">{t("basePrice")}</span>
                    <p className="text-value font-semibold text-ink">
                      {formatMoney(product.basePrice, currency, locale)}
                    </p>
                    <p className="text-label text-ink-muted">{t("priceReadOnlyHint")}</p>
                  </div>
                )
              )}

              {canSeeCost && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="cost" className="text-label font-medium text-ink">
                    {t("cost")}
                  </label>
                  <NumericInput
                    id="cost"
                    allowDecimal
                    placeholder={t("optional")}
                    aria-invalid={!!errors.cost}
                    {...register("cost")}
                  />
                  {errors.cost && <FieldErrorText field="cost">{translateError(errors.cost.message ?? "")}</FieldErrorText>}
                </div>
              )}
            </div>
          </Card>

          {showActiveToggle && (
            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="isActive" className="text-label font-medium text-ink">
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
            </Card>
          )}

          {/* Opt-in per product: most pieces sit at stock 1, so a global alert would be noise. */}
          {canTrackLowStock && (
            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="trackLowStock" className="text-label font-medium text-ink">
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
            </Card>
          )}

          {!willHaveVariants && (
            <Card className="flex flex-col gap-4">
              <h3 className="text-section font-semibold text-ink">{t("inventory")}</h3>
              <div className="flex flex-col gap-4">
                {/* A numbered product keeps stock per number; the POS never sells the parent. */}
                {isNumbered && <p className="text-label text-ink-muted">{t("kind.stockPerNumber")}</p>}
                {canEditStock && !isNumbered && (
                  <div className="flex flex-col gap-2">
                    <span className="text-label font-medium text-ink">{t("stock")}</span>
                    {/* Controller: the stepper returns a clamped number; the form field is a string. */}
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
                  <label htmlFor="sku" className="text-label font-medium text-ink">
                    {t("sku")}
                  </label>
                  <Input id="sku" data-test-selector={fieldTestSelector("sku")} value={product?.sku ?? t("autoGenerated")} disabled readOnly />
                </div>
              </div>
            </Card>
          )}

          {/* Shown for variant products too: one supplier code on the parent opens the POS variant picker (rule 13). */}
          <Card className="flex flex-col gap-4">
            <h3 className="text-section font-semibold text-ink">{t("barcode.title")}</h3>
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
          </Card>
        </>
      )}

      {showVariantsCard && (
        <Card className="flex flex-col gap-4">
          <h3 className="text-section font-semibold text-ink">{t("variants.title")}</h3>
          <div className="flex flex-col gap-4">
            {mode === "edit" && product?.hasVariants && (
              <VariantEditList
                // Placed shawl points are edited in the dedicated tool below.
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
                <VariantPreviewList rows={previewRows} excluded={excludedCombos} onToggleExcluded={toggleExcludedCombo} />
              </>
            )}

            {mode === "edit" && product && variantTypes && canEditDetails && (
              <AddVariantsSection productId={product.id} variantTypes={ordinaryVariantTypes} />
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
        </Card>
      )}

      {/* Reads the SAVED product: the API refuses numbers until the product itself says it is numbered. */}
      {isNumbered && canEditDetails && (mode === "create" || !product?.isNumbered) && (
        <Card className="flex flex-col gap-4">
          <h3 className="text-section font-semibold text-ink">{t("numberedShawl.title")}</h3>
          <div>
            <p className="text-label text-ink-muted">{t("kind.placeNumbersAfterSave")}</p>
          </div>
        </Card>
      )}

      {mode === "edit" && canEditDetails && canEditPrice && canEditStock && product && variantTypes && isNumbered && showNumberedShawlEditor(product) && (
        <Card className="flex flex-col gap-4">
          <h3 className="text-section font-semibold text-ink">{t("numberedShawl.title")}</h3>
          <div>
            <NumberedShawlEditor product={product} variantTypes={variantTypes} currency={currency} />
          </div>
        </Card>
      )}

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

      {/* Retry only the photos: pressing Save again would file a second product. */}
      {partialFailure ? (
        <Alert tone="danger" title={t("partial.title")}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              {/* With none pending (order or main photo failed), the plain reason instead of "0 photos". */}
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
      ) : (
        canSave && (
          <>
            <Button type="submit" data-test-selector="product-save" isLoading={isBusy} className="w-full sm:w-auto sm:self-start">
              {isBusy ? t(mode === "create" ? "creating" : "saving") : t(mode === "create" ? "create" : "save")}
            </Button>
            {saveStep && (
              <p aria-live="polite" className="text-center text-label text-ink-muted">
                {saveStep.kind === "images"
                  ? t("progress.images", { done: saveStep.done, total: saveStep.total })
                  : t(saveStep.kind === "product" ? "progress.product" : "progress.variants")}
              </p>
            )}
          </>
        )
      )}
    </FormContainer>
  );
}

function FieldErrorText({ field, children }: { field: string; children: ReactNode }) {
  return (
    <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector(field)}>
      {children}
    </p>
  );
}

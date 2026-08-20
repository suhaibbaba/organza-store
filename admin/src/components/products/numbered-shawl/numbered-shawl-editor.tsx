"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { NUMBER_VARIANT_TYPE_SLUG } from "@organza/shared/constants/variantType";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { resolvePointColors, suggestPointColors } from "@organza/shared/lib/pointColors";
import type { UpdateVariantInput } from "@organza/shared/schemas/product";
import type { Product } from "@organza/shared/types/product";
import type { VariantType } from "@organza/shared/types/variant";
import { useAddOptionValueMutation } from "@/hooks/use-variant-types";
import {
  useDeleteVariantMutation,
  useGenerateVariantsMutation,
  useUpdateProductMutation,
  useUpdateVariantMutation,
} from "@/hooks/use-products";
import { useTranslateError } from "@/hooks/use-translate-error";
import {
  diffShawlPoint,
  initPointNotes,
  initShawlPoints,
  newShawlPoint,
  nextPointNumber,
  roundPercent,
} from "@/lib/validation/numbered-shawl";
import {
  diffOptionValueNotes,
  setNoteLanguage,
  type OptionValueNoteMap,
} from "@/lib/option-value-notes";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { ImagePointCanvas } from "@/components/products/numbered-shawl/image-point-canvas";
import { PointDetailsList } from "@/components/products/numbered-shawl/point-details-list";
import { PointColorControls } from "@/components/products/numbered-shawl/point-color-controls";
import { OptionValueNotesSection } from "@/components/products/option-value-notes-section";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";
import { localize } from "@/lib/i18n-content";
import type { I18nFormValue } from "@/types/productForm";
import type { ShawlPoint } from "@/types/numberedShawl";

interface NumberedShawlEditorProps {
  product: Product;
  variantTypes: VariantType[];
  currency: string;
}

type Step = "place" | "details";

// Edit-mode only, two-step placement flow (spec.md "Numbered shawls"):
// Step 1 places/moves/deletes numbered points on the product's image, Step
// 2 sets quantity/price per number. Entirely self-contained (own Save
// button, own API calls) like AddVariantsSection/ImageManager — nothing is
// linked/committed until Save.
export function NumberedShawlEditor({ product, variantTypes, currency }: NumberedShawlEditorProps) {
  const t = useTranslations("products.form.numberedShawl");
  const locale = useLocale();
  const translateError = useTranslateError();

  const image = product.images.find((img) => img.isPrimary) ?? product.images[0] ?? null;

  const [step, setStep] = useState<Step>("place");
  const [points, setPoints] = useState<ShawlPoint[]>(() => initShawlPoints(product.variants));
  // The marker colours, held as the product stores them: null means "follow
  // the photo", so a product nobody has chosen for keeps tracking its image
  // instead of being pinned to whatever it looked like the first time this
  // screen was opened.
  const [textColor, setTextColor] = useState<string | null>(product.pointTextColor);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(product.pointBackgroundColor);
  // What each number MEANS on this shawl (spec.md "Notes on a product's
  // options") — "شال حرير" against number 4. Keyed by POINT rather than by
  // option value, so a number placed a moment ago can be annotated before the
  // save has given it a global value.
  const initialNotes = useMemo(() => initPointNotes(product), [product]);
  const [notes, setNotes] = useState<OptionValueNoteMap>(initialNotes);
  const [removedVariantIds, setRemovedVariantIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const addOptionValueMutation = useAddOptionValueMutation();
  const generateVariantsMutation = useGenerateVariantsMutation(product.id);
  const updateVariantMutation = useUpdateVariantMutation(product.id);
  const deleteVariantMutation = useDeleteVariantMutation(product.id);
  const updateProductMutation = useUpdateProductMutation(product.id);

  const isSaving =
    addOptionValueMutation.isPending ||
    generateVariantsMutation.isPending ||
    updateVariantMutation.isPending ||
    deleteVariantMutation.isPending ||
    updateProductMutation.isPending;

  const colorsChanged =
    textColor !== product.pointTextColor || backgroundColor !== product.pointBackgroundColor;
  // Detected on the point keys alone: whether the notes changed is a question
  // that must be answerable before any value id has been resolved.
  const notesChanged = diffOptionValueNotes(initialNotes, notes).length > 0;

  const isDirty =
    colorsChanged ||
    notesChanged ||
    points.some((p) => !p.variantId) ||
    removedVariantIds.size > 0 ||
    points.some((p) => {
      if (!p.variantId) return false;
      const original = product.variants.find((v) => v.id === p.variantId);
      return original ? Boolean(diffShawlPoint(original, p)) : false;
    });

  function markDirty() {
    setSaved(false);
    setSaveError(null);
  }

  function handleAddPoint(x: number, y: number) {
    markDirty();
    const point = newShawlPoint(nextPointNumber(points), x, y);
    setPoints((prev) => [...prev, point]);
    setSelectedId(point.id);
  }

  function handleMovePoint(id: string, x: number, y: number) {
    markDirty();
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, x: roundPercent(x), y: roundPercent(y) } : p)));
  }

  function handleSelectPoint(id: string | null) {
    setSelectedId(id);
    setConfirmDeleteId(null);
  }

  function handleConfirmDelete(id: string) {
    markDirty();
    const point = points.find((p) => p.id === id);
    if (point?.variantId) setRemovedVariantIds((prev) => new Set(prev).add(point.variantId as string));
    setPoints((prev) => prev.filter((p) => p.id !== id));
    setSelectedId(null);
    setConfirmDeleteId(null);
  }

  function handleColorChange(field: "textColor" | "backgroundColor", value: string) {
    markDirty();
    if (field === "textColor") setTextColor(value);
    else setBackgroundColor(value);
  }

  // Back to following the photo — both halves at once, because "use the
  // suggestion" is one decision, not two.
  function handleUseSuggestedColors() {
    markDirty();
    setTextColor(null);
    setBackgroundColor(null);
  }

  function handleNoteChange(pointId: string, language: keyof I18nFormValue, text: string) {
    markDirty();
    setNotes((previous) => setNoteLanguage(previous, pointId, language, text));
  }

  function handlePointField(id: string, field: "stock" | "priceOverride", value: string) {
    markDirty();
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  async function handleSave() {
    setSaveError(null);
    setSaved(false);
    try {
      const numberType = variantTypes.find((vt) => vt.slug === NUMBER_VARIANT_TYPE_SLUG);
      if (!numberType) throw new ApiError(500, ERROR_CODES.INTERNAL);

      // Resolve (or create) each new point's global option value first —
      // sequential, not parallel, so two brand-new numbers in the same save
      // never race to create the same value (CLAUDE.md rule 2).
      const valueIdByKey = new Map(numberType.values.map((v) => [v.key, v.id]));
      const resolved: ShawlPoint[] = [];
      for (const point of points) {
        if (point.valueId) {
          resolved.push(point);
          continue;
        }
        const key = String(point.number);
        let valueId = valueIdByKey.get(key);
        if (!valueId) {
          const created = await addOptionValueMutation.mutateAsync({
            variantTypeId: numberType.id,
            value: { ar: key },
          });
          valueId = created.id;
          valueIdByKey.set(key, valueId);
        }
        resolved.push({ ...point, valueId });
      }

      const newPoints = resolved.filter((p) => !p.variantId);
      const existingPoints = resolved.filter((p) => p.variantId);

      const createdVariantIdByValueId = new Map<string, string>();
      if (newPoints.length > 0) {
        const updated = await generateVariantsMutation.mutateAsync({
          optionSelections: [
            {
              variantTypeId: numberType.id,
              valueIds: newPoints.map((p) => p.valueId as string),
              imagePoints: Object.fromEntries(
                newPoints.map((p) => [p.valueId as string, { imageX: p.x, imageY: p.y }])
              ),
            },
          ],
        });
        for (const variant of updated.variants) {
          const valueId = variant.values[0]?.id;
          if (valueId) createdVariantIdByValueId.set(valueId, variant.id);
        }
      }

      const calls: Promise<unknown>[] = [];

      // The colours and the notes both live on the PRODUCT, not on any point,
      // so they travel together in one PATCH — and only what changed is in
      // it. The notes are keyed by point up to this line; here each one
      // finally learns which global value it belongs to.
      const valueIdByPointId = new Map(resolved.map((point) => [point.id, point.valueId]));
      const noteChanges = diffOptionValueNotes(
        initialNotes,
        notes,
        (pointId) => valueIdByPointId.get(pointId) ?? null
      );
      if (colorsChanged || noteChanges.length > 0) {
        calls.push(
          updateProductMutation.mutateAsync({
            ...(colorsChanged ? { pointTextColor: textColor, pointBackgroundColor: backgroundColor } : {}),
            ...(noteChanges.length > 0 ? { optionValueNotes: noteChanges } : {}),
          })
        );
      }

      for (const point of existingPoints) {
        const original = product.variants.find((v) => v.id === point.variantId);
        const patch = original ? diffShawlPoint(original, point) : null;
        if (patch) calls.push(updateVariantMutation.mutateAsync({ variantId: point.variantId as string, input: patch }));
      }

      for (const point of newPoints) {
        const variantId = createdVariantIdByValueId.get(point.valueId as string);
        if (!variantId) continue;
        const patch: UpdateVariantInput = {};
        const stock = Number(point.stock);
        if (isNonNegativeIntegerString(point.stock) && stock !== 1) patch.stock = stock;
        if (point.priceOverride.trim() !== "") patch.priceOverride = point.priceOverride.trim();
        if (Object.keys(patch).length > 0) calls.push(updateVariantMutation.mutateAsync({ variantId, input: patch }));
      }

      for (const variantId of removedVariantIds) {
        calls.push(deleteVariantMutation.mutateAsync(variantId));
      }

      await Promise.all(calls);

      setRemovedVariantIds(new Set());
      setSaved(true);
    } catch (err) {
      setSaveError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  if (!image) {
    return <p className="text-sm text-muted-foreground">{t("needsImage")}</p>;
  }

  const selectedPoint = selectedId ? points.find((p) => p.id === selectedId) ?? null : null;

  // One block, one row per number placed — including a number placed a moment
  // ago, which is keyed by its point until the save resolves its value.
  const numberType = variantTypes.find((vt) => vt.slug === NUMBER_VARIANT_TYPE_SLUG);
  const noteGroups = [
    {
      id: numberType?.id ?? NUMBER_VARIANT_TYPE_SLUG,
      typeName: numberType ? localize(numberType.name, locale) : "",
      rows: [...points]
        .sort((a, b) => a.number - b.number)
        .map((point) => ({ key: point.id, label: String(point.number) })),
    },
  ];

  // What the numbers are drawn in right now, including a colour being picked
  // that has not been saved yet — the canvas above is the preview, so there
  // is no second little swatch to keep in step with it.
  const suggestion = suggestPointColors(image.brightness);
  const colors = resolvePointColors(
    { pointTextColor: textColor, pointBackgroundColor: backgroundColor },
    image.brightness
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Two steps, each as wide as its own name: the halves this used to be
          gave "وضع الأرقام" the same room as "التفاصيل" and broke the long
          one onto a second line. */}
      <SegmentedControl
        label={t("stepsLabel")}
        value={step}
        onChange={setStep}
        options={[
          { value: "place", label: t("stepPlace") },
          { value: "details", label: t("stepDetails") },
        ]}
      />

      {step === "place" ? (
        <>
          <p className="text-sm text-muted-foreground">{t("placeHint")}</p>
          <ImagePointCanvas
            imageUrl={image.url}
            alt={t("imageAlt")}
            points={points}
            selectedId={selectedId}
            colors={colors}
            disabled={isSaving}
            onAddPoint={handleAddPoint}
            onMovePoint={handleMovePoint}
            onSelectPoint={handleSelectPoint}
          />

          <PointColorControls
            textColor={textColor}
            backgroundColor={backgroundColor}
            suggestion={suggestion}
            adjustedForContrast={colors.textAdjustedForContrast}
            onChange={handleColorChange}
            onUseSuggestion={handleUseSuggestedColors}
            disabled={isSaving}
          />

          {selectedPoint && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
              <span className="text-sm font-medium text-foreground">{t("pointLabel", { number: selectedPoint.number })}</span>
              {confirmDeleteId === selectedPoint.id ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="destructive" size="sm" onClick={() => handleConfirmDelete(selectedPoint.id)}>
                    {t("confirmDelete")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                    {t("cancelDelete")}
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteId(selectedPoint.id)}>
                  {t("deletePoint")}
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <PointDetailsList
            points={points}
            currency={currency}
            locale={locale}
            basePrice={product.basePrice}
            onFieldChange={handlePointField}
          />

          {/* A note per number, in the same collapsed block an ordinary
              product's sizes and colours use (spec.md "Notes on a product's
              options"): a number is an option value like any other, and it
              is annotated here rather than drawn on the photograph, where
              the markers are already tight and text over a picture cannot be
              relied on to be readable. */}
          <OptionValueNotesSection
            groups={noteGroups}
            notes={notes}
            onChange={handleNoteChange}
            disabled={isSaving}
          />
        </>
      )}

      {saveError && <Alert variant="destructive">{saveError}</Alert>}
      {saved && <Alert variant="success">{t("saveSuccess")}</Alert>}

      <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !isDirty} className="w-full sm:w-auto sm:self-start">
        {isSaving ? (
          <>
            <Spinner />
            {t("saving")}
          </>
        ) : (
          t("save")
        )}
      </Button>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button, SegmentedControl } from "@store/ui";
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
  firstUnplacedPoint,
  initShawlPoints,
  newShawlPoint,
  nextPointNumber,
  placedShawlPoints,
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

// Self-contained like ImageManager: own Save and API calls, nothing committed until Save (spec.md "Numbered shawls").
export function NumberedShawlEditor({ product, variantTypes, currency }: NumberedShawlEditorProps) {
  const t = useTranslations("products.form.numberedShawl");
  const locale = useLocale();
  const translateError = useTranslateError();

  const image = product.images.find((img) => img.isPrimary) ?? product.images[0] ?? null;

  const [step, setStep] = useState<Step>("place");
  const [points, setPoints] = useState<ShawlPoint[]>(() => initShawlPoints(product.variants));
  // null = follow the photo, so an unchosen product keeps tracking its image.
  const [textColor, setTextColor] = useState<string | null>(product.pointTextColor);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(product.pointBackgroundColor);
  // Keyed by POINT, so a just-placed number can be annotated before Save gives it a global value.
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
  // Point keys only: must be answerable before any value id is resolved.
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
    // An existing unplaced number is placed first; only then does a tap create a new one.
    const unplaced = firstUnplacedPoint(points);
    if (unplaced) {
      setPoints((prev) => prev.map((p) => (p.id === unplaced.id ? { ...p, x: roundPercent(x), y: roundPercent(y) } : p)));
      setSelectedId(unplaced.id);
      return;
    }
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

  // Both halves at once: "use the suggestion" is one decision.
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

      // Sequential, so two new numbers never race to create the same value (rule 2).
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
              // A new point is only ever made by a tap, so it is always placed.
              imagePoints: Object.fromEntries(
                placedShawlPoints(newPoints).map((p) => [p.valueId as string, { imageX: p.x, imageY: p.y }])
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

      // Colours and notes live on the PRODUCT, so they travel in one PATCH with only what changed.
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
    return <p className="text-label text-ink-muted">{t("needsImage")}</p>;
  }

  const selectedPoint = selectedId ? points.find((p) => p.id === selectedId) ?? null : null;

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

  // Includes an unsaved pick: the canvas is the preview.
  const suggestion = suggestPointColors(image.brightness);
  const colors = resolvePointColors(
    { pointTextColor: textColor, pointBackgroundColor: backgroundColor },
    image.brightness
  );

  return (
    <div className="flex flex-col gap-4">
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
          <p className="text-label text-ink-muted">{t("placeHint")}</p>
          <ImagePointCanvas
            imageUrl={image.url}
            alt={t("imageAlt")}
            points={placedShawlPoints(points)}
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
            <div className="flex items-center justify-between gap-3 rounded-panel border border-line bg-surface p-3">
              <span className="text-label font-medium text-ink">{t("pointLabel", { number: selectedPoint.number })}</span>
              {confirmDeleteId === selectedPoint.id ? (
                <div className="flex items-center gap-2">
                  <Button variant="danger" size="sm" onClick={() => handleConfirmDelete(selectedPoint.id)}>
                    {t("confirmDelete")}
                  </Button>
                  <Button variant="quiet" size="sm" onClick={() => setConfirmDeleteId(null)}>
                    {t("cancelDelete")}
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(selectedPoint.id)}>
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

          {/* Notes go here, not on the photo, where markers are tight and text over a picture isn't reliably readable. */}
          <OptionValueNotesSection
            groups={noteGroups}
            notes={notes}
            onChange={handleNoteChange}
            disabled={isSaving}
          />
        </>
      )}

      {saveError && <Alert tone="danger">{saveError}</Alert>}
      {saved && <Alert tone="success">{t("saveSuccess")}</Alert>}

      <Button
        onClick={() => void handleSave()}
        disabled={!isDirty}
        isLoading={isSaving}
        className="w-full sm:w-auto sm:self-start"
      >
        {isSaving ? t("saving") : t("save")}
      </Button>
    </div>
  );
}

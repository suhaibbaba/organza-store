"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { NUMBER_VARIANT_TYPE_SLUG } from "@shared/constants/variantType";
import { ERROR_CODES } from "@shared/constants/errors";
import type { UpdateVariantInput } from "@shared/schemas/product";
import type { Product } from "@shared/types/product";
import type { VariantType } from "@shared/types/variant";
import { useAddOptionValueMutation } from "@/hooks/use-variant-types";
import { useDeleteVariantMutation, useGenerateVariantsMutation, useUpdateVariantMutation } from "@/hooks/use-products";
import { useTranslateError } from "@/hooks/use-translate-error";
import {
  diffShawlPoint,
  initShawlPoints,
  newShawlPoint,
  nextPointNumber,
  roundPercent,
} from "@/lib/validation/numbered-shawl";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { ImagePointCanvas } from "@/components/products/numbered-shawl/image-point-canvas";
import { PointDetailsList } from "@/components/products/numbered-shawl/point-details-list";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
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
  const [removedVariantIds, setRemovedVariantIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const addOptionValueMutation = useAddOptionValueMutation();
  const generateVariantsMutation = useGenerateVariantsMutation(product.id);
  const updateVariantMutation = useUpdateVariantMutation(product.id);
  const deleteVariantMutation = useDeleteVariantMutation(product.id);

  const isSaving =
    addOptionValueMutation.isPending ||
    generateVariantsMutation.isPending ||
    updateVariantMutation.isPending ||
    deleteVariantMutation.isPending;

  const isDirty =
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-lg border border-border p-1">
        <button
          type="button"
          onClick={() => setStep("place")}
          aria-pressed={step === "place"}
          className={cn(
            "min-h-10 flex-1 rounded-md text-sm font-medium transition-colors",
            step === "place" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          )}
        >
          {t("stepPlace")}
        </button>
        <button
          type="button"
          onClick={() => setStep("details")}
          aria-pressed={step === "details"}
          className={cn(
            "min-h-10 flex-1 rounded-md text-sm font-medium transition-colors",
            step === "details" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          )}
        >
          {t("stepDetails")}
        </button>
      </div>

      {step === "place" ? (
        <>
          <p className="text-sm text-muted-foreground">{t("placeHint")}</p>
          <ImagePointCanvas
            imageUrl={image.url}
            alt={t("imageAlt")}
            points={points}
            selectedId={selectedId}
            disabled={isSaving}
            onAddPoint={handleAddPoint}
            onMovePoint={handleMovePoint}
            onSelectPoint={handleSelectPoint}
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
        <PointDetailsList
          points={points}
          currency={currency}
          locale={locale}
          basePrice={product.basePrice}
          onFieldChange={handlePointField}
        />
      )}

      {saveError && <Alert variant="destructive">{saveError}</Alert>}
      {saved && <Alert variant="success">{t("saveSuccess")}</Alert>}

      <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !isDirty} className="w-full">
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

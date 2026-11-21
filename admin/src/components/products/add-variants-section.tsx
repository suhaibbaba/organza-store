"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button } from "@store/ui";
import type { VariantType } from "@organza/shared/types/variant";
import { useGenerateVariantsMutation } from "@/hooks/use-products";
import { deleteVariant } from "@/lib/api/products";
import { buildVariantPreview, toOptionSelections, comboKey } from "@/lib/variant-combo";
import { useTranslateError } from "@/hooks/use-translate-error";
import { VariantTypePicker } from "@/components/products/variant-type-picker";
import { VariantPreviewList } from "@/components/products/variant-preview-list";
import { ApiError } from "@/lib/api/errors";
import type { VariantSelectionMap } from "@/types/productForm";

interface AddVariantsSectionProps {
  productId: string;
  variantTypes: VariantType[];
}

// Separate from the form's Save: its own endpoint (POST .../variants/generate), and existing combinations are never touched (spec.md).
export function AddVariantsSection({ productId, variantTypes }: AddVariantsSectionProps) {
  const t = useTranslations("products.form.variants");
  const translateError = useTranslateError();
  const [selections, setSelections] = useState<VariantSelectionMap>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateMutation = useGenerateVariantsMutation(productId);

  const optionSelections = toOptionSelections(selections);
  const previewRows = useMemo(() => buildVariantPreview(variantTypes, selections), [variantTypes, selections]);

  function toggleExcluded(key: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleGenerate() {
    if (optionSelections.length === 0) return;
    setError(null);
    setSucceeded(false);
    try {
      const updated = await generateMutation.mutateAsync({ optionSelections });
      if (excluded.size > 0) {
        const toDelete = updated.variants.filter((v) => excluded.has(comboKey(v.values.map((val) => val.id))));
        await Promise.all(toDelete.map((v) => deleteVariant(productId, v.id)));
      }
      setSelections({});
      setExcluded(new Set());
      setSucceeded(true);
    } catch (err) {
      setError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-dashed border-line p-3">
      <p className="text-label font-medium text-ink">{t("addMoreTitle")}</p>
      <VariantTypePicker variantTypes={variantTypes} value={selections} onChange={setSelections} />
      <VariantPreviewList rows={previewRows} excluded={excluded} onToggleExcluded={toggleExcluded} />
      {error && <Alert tone="danger">{error}</Alert>}
      {succeeded && <Alert tone="success">{t("addMoreSuccess")}</Alert>}
      {optionSelections.length > 0 && (
        <Button onClick={() => void handleGenerate()} isLoading={generateMutation.isPending}>
          {t("generate")}
        </Button>
      )}
    </div>
  );
}

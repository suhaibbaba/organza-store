"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { VariantType } from "@shared/types/variant";
import { useGenerateVariantsMutation } from "@/hooks/use-products";
import { deleteVariant } from "@/lib/api/products";
import { buildVariantPreview, toOptionSelections, comboKey } from "@/lib/variant-combo";
import { useTranslateError } from "@/hooks/use-translate-error";
import { VariantTypePicker } from "@/components/products/variant-type-picker";
import { VariantPreviewList } from "@/components/products/variant-preview-list";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";
import type { VariantSelectionMap } from "@/types/productForm";

interface AddVariantsSectionProps {
  productId: string;
  variantTypes: VariantType[];
}

// Edit-mode only: generates additional combinations on top of a product's
// existing variants (or turns a simple product into a variant one on first
// use) — a separate, self-contained action from the main "Save" button,
// since it hits its own endpoint (POST .../variants/generate) and existing
// combinations are always left untouched (spec.md).
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
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3">
      <p className="text-sm font-medium text-foreground">{t("addMoreTitle")}</p>
      <VariantTypePicker variantTypes={variantTypes} value={selections} onChange={setSelections} />
      <VariantPreviewList rows={previewRows} excluded={excluded} onToggleExcluded={toggleExcluded} />
      {error && <Alert variant="destructive">{error}</Alert>}
      {succeeded && <Alert>{t("addMoreSuccess")}</Alert>}
      {optionSelections.length > 0 && (
        <Button type="button" onClick={() => void handleGenerate()} disabled={generateMutation.isPending}>
          {generateMutation.isPending ? <Spinner /> : t("generate")}
        </Button>
      )}
    </div>
  );
}

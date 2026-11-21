"use client";

import { useMemo, useState } from "react";
import { Button, Drawer } from "@store/ui";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VariantType } from "@organza/shared/types/variant";
import { buildVariantPreview } from "@/lib/variant-combo";
import { VariantTypePicker } from "@/components/products/variant-type-picker";
import { VariantPreviewList } from "@/components/products/variant-preview-list";
import type { VariantSelectionMap } from "@/types/productForm";

interface AddVariantsSectionProps {
  variantTypes: VariantType[];
  selections: VariantSelectionMap;
  onSelectionsChange: (selections: VariantSelectionMap) => void;
  excluded: Set<string>;
  onToggleExcluded: (key: string) => void;
  stocks: Record<string, number>;
  onStockChange?: (key: string, stock: number) => void;
}

export function AddVariantsSection({
  variantTypes,
  selections,
  onSelectionsChange,
  excluded,
  onToggleExcluded,
  stocks,
  onStockChange,
}: AddVariantsSectionProps) {
  const t = useTranslations("products.form.variants");
  const previewRows = useMemo(() => buildVariantPreview(variantTypes, selections), [variantTypes, selections]);
  const [open, setOpen] = useState(false);
  const count = previewRows.filter((row) => !excluded.has(row.key)).length;

  return (
    <div className="flex flex-col gap-3" data-test-selector="add-variants">
      <VariantPreviewList
        rows={previewRows}
        excluded={excluded}
        onToggleExcluded={onToggleExcluded}
        stocks={stocks}
        {...(onStockChange && { onStockChange })}
      />
      <Button
        variant="secondary"
        data-testid="add-variants-open"
        className="self-start"
        icon={<Plus className="size-4" aria-hidden="true" />}
        onClick={() => setOpen(true)}
      >
        {t("addButton")}
      </Button>
      <Drawer
        data-testid="add-variants-drawer"
        open={open}
        onOpenChange={setOpen}
        title={t("addMoreTitle")}
        descriptionKey="products.form.variants.addDescription"
        footer={
          <Button data-testid="add-variants-apply" onClick={() => setOpen(false)}>
            {count > 0 ? t("addCount", { count }) : t("done")}
          </Button>
        }
      >
        <VariantTypePicker variantTypes={variantTypes} value={selections} onChange={onSelectionsChange} />
      </Drawer>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button, Checkbox } from "@store/ui";
import { DEFAULT_STOCK } from "@organza/shared/constants/quantity";
import { QuantityStepper } from "@/components/fields/quantity-stepper";

interface VariantBulkBarProps {
  name: string;
  total: number;
  checked: number;
  onCheckAll: (on: boolean) => void;
  onSetStock?: ((stock: number) => void) | undefined;
  onRemove?: (() => void) | undefined;
}

export function VariantBulkBar({ name, total, checked, onCheckAll, onSetStock, onRemove }: VariantBulkBarProps) {
  const t = useTranslations("products.form.variants");
  const tCommon = useTranslations("common");
  const [stock, setStock] = useState(DEFAULT_STOCK);
  const stockName = t("bulkStock");

  return (
    <div
      data-test-selector={`${name}-bulk-bar`}
      className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 bg-inset px-3 py-2"
    >
      <Checkbox
        size="sm"
        data-testid={`${name}-bulk-select-all`}
        label={checked > 0 ? t("selectedCount", { count: checked }) : t("selectAll")}
        checked={checked === total}
        indeterminate={checked > 0 && checked < total}
        onCheckedChange={onCheckAll}
      />
      {checked > 0 && (
        <span className="ms-auto flex flex-wrap items-center gap-2">
          {onSetStock && (
            <>
              <QuantityStepper
                name={`${name}-bulk`}
                value={stock}
                onChange={setStock}
                decreaseLabel={tCommon("quantity.decrease", { name: stockName })}
                increaseLabel={tCommon("quantity.increase", { name: stockName })}
                valueLabel={tCommon("quantity.value", { name: stockName })}
              />
              <Button variant="secondary" data-testid={`${name}-bulk-set-stock`} onClick={() => onSetStock(stock)}>
                {t("bulkSetStock")}
              </Button>
            </>
          )}
          {onRemove && (
            <Button
              variant="quiet"
              data-testid={`${name}-bulk-remove`}
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
              icon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={onRemove}
            >
              {t("bulkRemove")}
            </Button>
          )}
        </span>
      )}
    </div>
  );
}

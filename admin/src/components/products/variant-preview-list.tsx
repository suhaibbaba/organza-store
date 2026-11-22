"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox, QuantityStepper } from "@store/ui";
import { X } from "lucide-react";
import { DEFAULT_STOCK } from "@store/shared/constants/quantity";
import { VariantBulkBar } from "@/components/products/variant-bulk-bar";
import { localize } from "@/lib/i18n-content";
import type { VariantPreviewRow } from "@/lib/variant-combo";
import { cn } from "@/lib/utils";

interface VariantPreviewListProps {
  rows: VariantPreviewRow[];
  excluded: Set<string>;
  onToggleExcluded: (key: string) => void;
  stocks?: Record<string, number>;
  onStockChange?: (key: string, stock: number) => void;
}

export function VariantPreviewList({
  rows,
  excluded,
  onToggleExcluded,
  stocks,
  onStockChange,
}: VariantPreviewListProps) {
  const t = useTranslations("products.form.variants");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());

  if (rows.length === 0) {
    return null;
  }

  const liveKeys = rows.filter((row) => !excluded.has(row.key)).map((row) => row.key);
  const checked = liveKeys.filter((key) => checkedKeys.has(key));
  const bulk = liveKeys.length > 1;

  function toggleChecked(key: string, on: boolean) {
    setCheckedKeys((current) => {
      const next = new Set(current);
      if (on) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  const activeCount = rows.length - excluded.size;

  return (
    <div className="flex flex-col gap-2" data-test-selector="variant-preview">
      <p className="text-label text-ink">{t("previewCount", { count: activeCount })}</p>
      <div className="divide-y divide-line overflow-hidden rounded-control border border-line bg-surface">
        {bulk && (
          <VariantBulkBar
            name="variant-preview"
            total={liveKeys.length}
            checked={checked.length}
            onCheckAll={(on) => setCheckedKeys(new Set(on ? liveKeys : []))}
            onSetStock={onStockChange && ((stock) => checked.forEach((key) => onStockChange(key, stock)))}
            onRemove={() => {
              checked.forEach((key) => onToggleExcluded(key));
              setCheckedKeys(new Set());
            }}
          />
        )}
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const isExcluded = excluded.has(row.key);
            const name = localize(row.name, locale);
            return (
              <li
                key={row.key}
                data-test-selector={`variant-preview-row-${row.key}`}
                className={cn(
                  "flex min-h-13 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2",
                  isExcluded && "bg-inset",
                )}
              >
                {bulk && !isExcluded && (
                  <Checkbox
                    size="sm"
                    hideLabel
                    data-testid={`variant-preview-select-${row.key}`}
                    label={t("selectRow", { name })}
                    checked={checkedKeys.has(row.key)}
                    onCheckedChange={(on) => toggleChecked(row.key, on)}
                  />
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 text-value break-words text-ink sm:basis-0",
                    isExcluded && "text-ink-muted line-through",
                  )}
                >
                  {name}
                </span>
                <span className="flex w-full items-center justify-between gap-3 sm:w-auto">
                  {onStockChange && !isExcluded && (
                    <QuantityStepper
                      name={`preview-${row.key}`}
                      value={stocks?.[row.key] ?? DEFAULT_STOCK}
                      onChange={(stock) => onStockChange(row.key, stock)}
                      decreaseLabel={tCommon("quantity.decrease", { name })}
                      increaseLabel={tCommon("quantity.increase", { name })}
                      valueLabel={tCommon("quantity.value", { name })}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleExcluded(row.key)}
                    className="ms-auto inline-flex h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill px-2 text-ink-muted hover:bg-inset hover:text-ink focus-visible:bg-neutral-200 focus-visible:text-ink"
                    aria-label={isExcluded ? t("restoreCombo") : t("removeCombo")}
                  >
                    {isExcluded ? <span className="text-label">{t("undo")}</span> : <X className="size-4" />}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

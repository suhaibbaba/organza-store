"use client";

import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { localize } from "@/lib/i18n-content";
import type { VariantPreviewRow } from "@/lib/variant-combo";
import { cn } from "@/lib/utils";

interface VariantPreviewListProps {
  rows: VariantPreviewRow[];
  excluded: Set<string>;
  onToggleExcluded: (key: string) => void;
}

// The backend always generates the full cartesian, so excluded combos are deleted right after create (product-form.tsx).
export function VariantPreviewList({ rows, excluded, onToggleExcluded }: VariantPreviewListProps) {
  const t = useTranslations("products.form.variants");
  const locale = useLocale();

  if (rows.length === 0) return null;

  const activeCount = rows.length - excluded.size;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-label font-medium text-ink">{t("previewCount", { count: activeCount })}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => {
          const isExcluded = excluded.has(row.key);
          return (
            <div
              key={row.key}
              className={cn(
                "flex items-center justify-between gap-3 rounded-panel border border-line bg-surface p-3",
                isExcluded && "opacity-50"
              )}
            >
              <span className={cn("text-label font-medium text-ink", isExcluded && "line-through")}>
                {localize(row.name, locale)}
              </span>
              <button
                type="button"
                onClick={() => onToggleExcluded(row.key)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-ink-muted hover:bg-inset hover:text-ink"
                aria-label={isExcluded ? t("restoreCombo") : t("removeCombo")}
              >
                {isExcluded ? <span className="text-xs font-medium">{t("undo")}</span> : <X className="size-4" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

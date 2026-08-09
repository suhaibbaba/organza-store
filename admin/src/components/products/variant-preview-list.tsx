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

// Create-mode only: shows the cartesian combinations that will be generated
// on save (spec.md), with a per-row remove so the user can skip combos they
// don't stock (excluded rows are deleted right after the create call — see
// product-form.tsx — since the backend always generates the full cartesian).
export function VariantPreviewList({ rows, excluded, onToggleExcluded }: VariantPreviewListProps) {
  const t = useTranslations("products.form.variants");
  const locale = useLocale();

  if (rows.length === 0) return null;

  const activeCount = rows.length - excluded.size;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">{t("previewCount", { count: activeCount })}</p>
      {/* A combination is a short name and a remove button. Three variant
          types make a cartesian of thirty of them, and a row each turned the
          preview into a scroll on every screen — so they flow instead. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => {
          const isExcluded = excluded.has(row.key);
          return (
            <div
              key={row.key}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3",
                isExcluded && "opacity-50"
              )}
            >
              <span className={cn("text-sm font-medium text-foreground", isExcluded && "line-through")}>
                {localize(row.name, locale)}
              </span>
              <button
                type="button"
                onClick={() => onToggleExcluded(row.key)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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

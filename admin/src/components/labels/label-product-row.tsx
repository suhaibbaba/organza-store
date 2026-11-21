"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ProductSummary } from "@organza/shared/types/product";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { formatDate } from "@/lib/format";
import { ProductImage } from "@/components/products/product-image";
import { NumberedBadge } from "@/components/products/numbered-badge";

interface LabelProductRowProps {
  product: ProductSummary;
  selected: boolean;
  onToggle: (productId: string, selected: boolean) => void;
}

// The whole row is the tap target — a checkbox alone is a poor target on a phone.
export function LabelProductRow({ product, selected, onToggle }: LabelProductRowProps) {
  const locale = useLocale();
  const t = useTranslations("labels.row");
  const name = localize(product.name, locale);
  const printedAt = formatDate(product.labelsPrintedAt, locale);

  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card transition-colors hover:bg-row-hover active:bg-inset has-[:checked]:border-selected-line has-[:checked]:bg-selected"
      data-test-selector={testSelectorFor("label-row", product.id)}
    >
      {/* Native input: the row is already the <label>, and a nested label would double-toggle. */}
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) => onToggle(product.id, event.target.checked)}
        aria-label={t("select", { name })}
        className="size-5 shrink-0 cursor-pointer rounded-chip accent-primary-600 focus-darken"
      />

      <ProductImage src={product.image?.thumbnailUrl} alt="" className="size-12 shrink-0 rounded-chip" sizes="48px" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-label font-medium text-ink">{name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-meta text-ink-muted">
            {product.hasVariants ? t("variants", { count: product.variantCount }) : (product.sku ?? "")}
          </span>
          {product.isNumbered && <NumberedBadge count={product.numberCount} />}
        </div>
        {/* Informational, never a block: reprints and our label over a supplier's code are allowed. */}
        <p className="mt-1 text-meta text-ink-subtle">
          {!product.needsLabel
            ? t("supplierBarcode")
            : printedAt
              ? t("printedOn", { date: printedAt })
              : t("neverPrinted")}
        </p>
      </div>
    </label>
  );
}

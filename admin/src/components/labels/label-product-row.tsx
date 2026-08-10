"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ProductSummary } from "@organza/shared/types/product";
import { localize } from "@/lib/i18n-content";
import { formatDate } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductImage } from "@/components/products/product-image";
import { NumberedBadge } from "@/components/products/numbered-badge";

interface LabelProductRowProps {
  product: ProductSummary;
  selected: boolean;
  onToggle: (productId: string, selected: boolean) => void;
}

// The whole row is the tap target — a checkbox alone is a poor target on a
// phone, and this list is worked through in batches.
export function LabelProductRow({ product, selected, onToggle }: LabelProductRowProps) {
  const locale = useLocale();
  const t = useTranslations("labels.row");
  const name = localize(product.name, locale);
  const printedAt = formatDate(product.labelsPrintedAt, locale);

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors active:bg-accent has-[:checked]:border-primary">
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => onToggle(product.id, checked === true)}
        aria-label={t("select", { name })}
      />

      <ProductImage src={product.image?.thumbnailUrl} alt="" className="size-12 shrink-0 rounded-lg" sizes="48px" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-muted-foreground">
            {product.hasVariants ? t("variants", { count: product.variantCount }) : (product.sku ?? "")}
          </span>
          {product.isNumbered && <NumberedBadge count={product.numberCount} />}
        </div>
        {/* Helpful, never a block: a product that has been printed before can
            always be printed again — and a piece that arrived already barcoded
            says so instead of claiming a label is owed. It is still selectable:
            printing our own label over the supplier's code is allowed. */}
        <p className="mt-1 text-xs text-muted-foreground">
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

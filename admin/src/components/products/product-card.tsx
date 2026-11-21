import { useLocale, useTranslations } from "next-intl";
import type { ProductSummary } from "@organza/shared/types/product";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { ProductImage } from "@/components/products/product-image";
import { StatusBadge } from "@/components/products/status-badge";
import { NumberedBadge } from "@/components/products/numbered-badge";
import { IncompleteBadge } from "@/components/products/incomplete-badge";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductSummary;
  currency: string;
}

export function ProductCard({ product, currency }: ProductCardProps) {
  const locale = useLocale();
  const t = useTranslations("products");
  const name = localize(product.name, locale);
  const outOfStock = product.stock <= 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 text-start shadow-card transition-colors hover:bg-row-hover focus-visible:bg-inset active:bg-inset"
      data-test-selector={testSelectorFor("product-card", product.id)}
    >
      <ProductImage src={product.image?.thumbnailUrl} alt={name} className="size-16 shrink-0 rounded-control" sizes="64px" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-label font-medium text-ink" data-test-selector="product-card-name">
            {name}
          </p>
          <StatusBadge isActive={product.isActive} />
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="min-w-0 truncate text-micro text-ink-muted">{product.sku ?? t("card.multipleSkus")}</p>
          {product.needsCompleting && <IncompleteBadge />}
          {product.isNumbered && <NumberedBadge count={product.numberCount} />}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-label font-semibold text-ink" data-test-selector="product-card-price">
            {formatMoney(product.basePrice, currency, locale)}
          </span>
          <span
            className={cn("text-micro font-medium", outOfStock ? "text-danger-600" : "text-ink-muted")}
            data-test-selector="product-card-stock"
          >
            {outOfStock ? t("card.outOfStock") : t("card.stock", { count: product.stock })}
          </span>
        </div>
      </div>
    </Link>
  );
}

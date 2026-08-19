import { useLocale, useTranslations } from "next-intl";
import type { ProductSummary } from "@organza/shared/types/product";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { ProductImage } from "@/components/products/product-image";
import { StatusBadge } from "@/components/products/status-badge";
import { NumberedBadge } from "@/components/products/numbered-badge";
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
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-start transition-colors active:bg-accent"
      // The row itself, and the id of the product it stands for — so one row
      // out of forty can be named (CLAUDE.md "Test selectors"). The id, never
      // the name or the price: this attribute ships to production.
      data-test-selector={testSelectorFor("product-card", product.id)}
    >
      <ProductImage src={product.image?.thumbnailUrl} alt={name} className="size-16 shrink-0 rounded-lg" sizes="64px" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground" data-test-selector="product-card-name">
            {name}
          </p>
          <StatusBadge isActive={product.isActive} />
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="min-w-0 truncate text-xs text-muted-foreground">{product.sku ?? t("card.multipleSkus")}</p>
          {product.isNumbered && <NumberedBadge count={product.numberCount} />}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground" data-test-selector="product-card-price">
            {formatMoney(product.basePrice, currency, locale)}
          </span>
          <span
            className={cn("text-xs font-medium", outOfStock ? "text-destructive" : "text-muted-foreground")}
            data-test-selector="product-card-stock"
          >
            {outOfStock ? t("card.outOfStock") : t("card.stock", { count: product.stock })}
          </span>
        </div>
      </div>
    </Link>
  );
}

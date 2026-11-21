"use client";

import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Alert, Input, Spinner } from "@store/ui";
import type { ProductSummary } from "@organza/shared/types/product";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useProductSearch } from "@/hooks/use-product-search";
import { ProductImage } from "@/components/products/product-image";

interface ProductPickerProps {
  query: string;
  onQueryChange: (query: string) => void;
  // Id of the row just tapped, while its full detail loads.
  pendingId: string | null;
  onSelect: (product: ProductSummary) => void;
}

// The catalogue's cross-language, typo-tolerant search (rule 10); a whole row is the tap target.
export function ProductPicker({ query, onQueryChange, pendingId, onSelect }: ProductPickerProps) {
  const t = useTranslations("orders.new.search");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const search = useProductSearch(query);

  const products = search.data?.products ?? [];
  const isLoading = search.isActive && (search.isPending || search.isTyping);

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        adornment="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onClear={() => onQueryChange("")}
        clearLabel={t("clear")}
        placeholder={t("placeholder")}
        aria-label={t("label")}
        autoComplete="off"
        enterKeyHint="search"
      />

      {search.isError && (
        <Alert tone="danger" data-testid="alert-destructive">
          {t("error")}
        </Alert>
      )}

      {isLoading && (
        <p className="flex items-center justify-center gap-2 py-6 text-label text-ink-muted">
          <Spinner />
          {t("searching")}
        </p>
      )}

      {search.isActive && !isLoading && products.length === 0 && (
        <p className="py-6 text-center text-label text-ink-muted">{t("empty")}</p>
      )}

      {!isLoading && products.length > 0 && (
        <ul className="flex flex-col gap-2" data-test-selector="order-product-results">
          {products.map((product) => {
            const name = localize(product.name, locale);
            const soldOut = product.stock <= 0;

            return (
              <li key={product.id}>
                <button
                  data-test-selector={testSelectorFor("order-product-result", product.id)}
                  type="button"
                  disabled={soldOut || pendingId !== null}
                  onClick={() => onSelect(product)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-panel border border-line bg-surface p-3 text-start transition-colors not-disabled:hover:bg-row-hover focus-visible:bg-inset disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ProductImage
                    src={product.image?.thumbnailUrl}
                    alt={name}
                    className="size-14 shrink-0 rounded-control"
                    sizes="56px"
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-label font-medium text-ink">{name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-micro text-ink-muted">
                      <span className="font-semibold text-ink">{formatMoney(product.basePrice)}</span>
                      {product.hasVariants && <span>· {t("variantCount", { count: product.variantCount })}</span>}
                      <span className={soldOut ? "text-danger-600" : undefined}>
                        · {soldOut ? t("soldOut") : t("inStock", { count: product.stock })}
                      </span>
                    </span>
                  </span>

                  {pendingId === product.id ? (
                    <Spinner />
                  ) : (
                    <Plus className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

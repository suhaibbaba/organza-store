"use client";

import { useLocale, useTranslations } from "next-intl";
import { Plus, Search, X } from "lucide-react";
import type { ProductSummary } from "@shared/types/product";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useProductSearch } from "@/hooks/use-product-search";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ProductImage } from "@/components/products/product-image";

interface ProductPickerProps {
  query: string;
  onQueryChange: (query: string) => void;
  // Id of the row just tapped, while its full detail loads.
  pendingId: string | null;
  onSelect: (product: ProductSummary) => void;
}

// Finding what the customer asked for. Same cross-language, typo-tolerant
// search the catalogue uses (CLAUDE.md rule 10), rendered as big rows: a
// whole row is the tap target, never a small link inside one.
export function ProductPicker({ query, onQueryChange, pendingId, onSelect }: ProductPickerProps) {
  const t = useTranslations("orders.new.search");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const search = useProductSearch(query);

  const products = search.data?.products ?? [];
  const isLoading = search.isActive && (search.isPending || search.isTyping);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          autoComplete="off"
          enterKeyHint="search"
          className="ps-11 pe-11"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label={t("clear")}
            className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {search.isError && <Alert variant="destructive">{t("error")}</Alert>}

      {isLoading && (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner />
          {t("searching")}
        </p>
      )}

      {search.isActive && !isLoading && products.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      )}

      {!isLoading && products.length > 0 && (
        <ul className="flex flex-col gap-2">
          {products.map((product) => {
            const name = localize(product.name, locale);
            const soldOut = product.stock <= 0;

            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={soldOut || pendingId !== null}
                  onClick={() => onSelect(product)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-start transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <ProductImage
                    src={product.image?.thumbnailUrl}
                    alt={name}
                    className="size-14 shrink-0 rounded-lg"
                    sizes="56px"
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{formatMoney(product.basePrice)}</span>
                      {product.hasVariants && <span>· {t("variantCount", { count: product.variantCount })}</span>}
                      <span className={soldOut ? "text-destructive" : undefined}>
                        · {soldOut ? t("soldOut") : t("inStock", { count: product.stock })}
                      </span>
                    </span>
                  </span>

                  {pendingId === product.id ? (
                    <Spinner className="text-muted-foreground" />
                  ) : (
                    <Plus className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
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

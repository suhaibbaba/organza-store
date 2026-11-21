"use client";

import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Alert, CardButton, Input, Spinner, Typography } from "@store/ui";
import type { ProductSummary } from "@organza/shared/types/product";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useProductSearch } from "@/hooks/use-product-search";
import { ProductPhoto } from "@/components/products/product-photo";

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
        // The picker sits inside the order form: Enter searches, it must never create the order.
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />

      {search.isError && (
        <Alert tone="danger" data-testid="alert-destructive">
          {t("error")}
        </Alert>
      )}

      {isLoading && (
        <Typography variant="small" tone="muted" className="flex items-center justify-center gap-2 py-6">
          <Spinner />
          {t("searching")}
        </Typography>
      )}

      {search.isActive && !isLoading && products.length === 0 && (
        <Typography variant="small" tone="muted" className="py-6 text-center">{t("empty")}</Typography>
      )}

      {search.isActive && !isLoading && products.length > 0 && (
        <ul
          className="grid max-h-[28rem] grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 overflow-y-auto p-0.5"
          data-test-selector="order-product-results"
        >
          {products.map((product) => {
            const name = localize(product.name, locale);
            const soldOut = product.stock <= 0;

            return (
              <li key={product.id}>
                <CardButton
                  data-testid={testSelectorFor("order-product-result", product.id)}
                  disabled={soldOut || pendingId !== null}
                  onClick={() => onSelect(product)}
                  className="h-full flex-col overflow-hidden"
                >
                  <span className="relative block aspect-square w-full bg-sunken">
                    <ProductPhoto product={product} alt={name} fit="contain" className="size-full" sizes="(max-width: 640px) 45vw, 160px" />
                    <span className="absolute end-2 top-2 flex size-8 items-center justify-center rounded-pill bg-surface/90 text-primary-700 shadow-card">
                      {pendingId === product.id ? <Spinner /> : <Plus className="size-4" aria-hidden="true" />}
                    </span>
                  </span>

                  <span className="flex flex-1 flex-col gap-1 p-2.5">
                    <Typography variant="small" weight="medium" as="span" className="line-clamp-2 group-hover:text-primary-700">{name}</Typography>
                    <Typography variant="small" weight="semibold" as="span">{formatMoney(product.basePrice)}</Typography>
                    <Typography variant="caption" tone="muted">
                      {product.hasVariants && <>{t("variantCount", { count: product.variantCount })} · </>}
                      <Typography as="span" variant="caption" tone={soldOut ? "error" : "inherit"}>
                        {soldOut ? t("soldOut") : t("inStock", { count: product.stock })}
                      </Typography>
                    </Typography>
                  </span>
                </CardButton>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

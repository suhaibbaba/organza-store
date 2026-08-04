"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import type { ProductSummary } from "@shared/types/product";
import { localize } from "@/lib/i18n-content";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { ProductThumb } from "@/components/sell/product-thumb";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

interface SearchResultsProps {
  results: ProductSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  // Id of the row the cashier just tapped, while its details load.
  pendingId: string | null;
  onSelect: (product: ProductSummary) => void;
}

// Big, thumb-sized rows: a whole row is the tap target, never a small link
// inside it. Out-of-stock products stay visible but can't be tapped — a
// cashier needs to see that the thing exists and is finished, not wonder
// whether they mistyped.
export function SearchResults({ results, isLoading, isError, pendingId, onSelect }: SearchResultsProps) {
  const t = useTranslations("sell.search");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  if (isError) {
    return <Alert variant="destructive">{t("error")}</Alert>;
  }

  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Spinner />
        {t("searching")}
      </p>
    );
  }

  if (results && results.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {(results ?? []).map((product) => {
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
              <ProductThumb src={product.image?.thumbnailUrl} alt={name} className="size-16 rounded-lg" />

              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-base font-medium">{name}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
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
                // rtl:rotate-180 — the chevron points "forward" in the
                // reading direction, which is rightward only in LTR.
                <ChevronRight className="size-5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

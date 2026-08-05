"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, PackageX, Pencil } from "lucide-react";
import type { Product } from "@shared/types/product";
import { can } from "@shared/lib/permissions";
import { Link } from "@/i18n/navigation";
import { useProductQuery } from "@/hooks/use-products";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useSession } from "@/components/providers/session-provider";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ProductGallery } from "@/components/products/product-gallery";
import { ProductDeleteAction } from "@/components/products/product-delete-action";
import {
  NumberedShawlPreview,
  hasPlacedShawlPoints,
} from "@/components/products/numbered-shawl/numbered-shawl-preview";
import { StatusBadge } from "@/components/products/status-badge";
import { VariantList } from "@/components/products/variant-list";
import { ProductListError, ProductListLoading } from "@/components/products/product-list-states";
import { ApiError } from "@/lib/api/errors";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations("products.detail");
  const { data: product, isLoading, isError, error, refetch } = useProductQuery(params.id);
  const { data: settings } = useSettingsQuery();
  const currency = settings?.currency ?? "ILS";

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/products" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("back")}
      </Link>

      {isLoading ? (
        <ProductListLoading />
      ) : notFound || !product ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <PackageX className="size-10 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">{t("notFoundTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("notFoundDescription")}</p>
          </div>
        </div>
      ) : isError ? (
        <ProductListError error={error} onRetry={() => void refetch()} />
      ) : (
        <ProductDetail product={product} currency={currency} locale={locale} />
      )}
    </div>
  );
}

function ProductDetail({ product, currency, locale }: { product: Product; currency: string; locale: string }) {
  const t = useTranslations("products.detail");
  const { user } = useSession();
  // One way in and one thing to press: Edit. Everything editable about a
  // product — including its photos — lives on the edit screen, so this page
  // only ever shows. What a given role may change once there is decided
  // there (price, stock and visibility are gated separately — CLAUDE.md
  // rule 5).
  const canEditDetails = can(user, "product.edit");
  const name = localize(product.name, locale);
  const description = localize(product.description, locale);
  const showCost = product.cost !== undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* A numbered shawl is its numbers: show the photo they were placed on,
          with them on it. Any other product gets the ordinary gallery. */}
      {hasPlacedShawlPoints(product) ? (
        <NumberedShawlPreview product={product} />
      ) : (
        <ProductGallery images={product.images} alt={name} />
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold text-foreground">{name}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge isActive={product.isActive} />
            {canEditDetails && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/products/${product.id}/edit`}>
                  <Pencil className="size-4" aria-hidden="true" />
                  {t("edit")}
                </Link>
              </Button>
            )}
          </div>
        </div>
        {product.category && (
          <p className="text-sm text-muted-foreground">{localize(product.category.name, locale)}</p>
        )}

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-foreground">{formatMoney(product.basePrice, currency, locale)}</span>
          {product.compareAtPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatMoney(product.compareAtPrice, currency, locale)}
            </span>
          )}
        </div>
        {showCost && product.cost && (
          <p className="text-sm text-muted-foreground">
            {t("cost")}: {formatMoney(product.cost, currency, locale)}
          </p>
        )}
      </div>

      {!product.hasVariants && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("sku")}</dt>
            <dd className="font-medium text-foreground">{product.sku ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("barcode")}</dt>
            <dd className="font-medium text-foreground">{product.barcode ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("stock")}</dt>
            <dd className="font-medium text-foreground">{product.stock ?? 0}</dd>
          </div>
        </dl>
      )}

      {description && (
        <div>
          <h2 className="text-sm font-medium text-foreground">{t("descriptionTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      )}

      {product.hasVariants && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-foreground">
            {t("variantsTitle")} · {t("variantsCount", { count: product.variants.length })}
          </h2>
          <VariantList variants={product.variants} variantTypes={product.variantTypes} currency={currency} />
        </div>
      )}

      <ProductDeleteAction product={product} />
    </div>
  );
}

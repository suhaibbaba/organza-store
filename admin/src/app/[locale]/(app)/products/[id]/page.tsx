"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Barcode, Boxes, Coins, FileText, Layers, Pencil, Tag } from "lucide-react";
import type { Product } from "@store/shared/types/product";
import { BARCODE_SOURCE } from "@store/shared/constants/barcode";
import { CHANGE_REQUEST_ENTITIES, CHANGE_REQUEST_FIELDS } from "@store/shared/constants/changeRequest";
import { SELECTABLE } from "@store/shared/lib/nativeGestures";
import { can } from "@store/shared/lib/permissions";
import { Badge, EmptyState, MenuItem, RowMenu, TotalBadge, Typography, buttonClassName } from "@store/ui";
import { Link } from "@/i18n/navigation";
import { useProductQuery } from "@/hooks/use-products";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useSession } from "@/components/providers/session-provider";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { buildGalleryPhotos } from "@/lib/product-gallery";
import { ApiError } from "@/lib/api/errors";
import { PageContainer } from "@/components/layout/page-container";
import { DetailCard } from "@/components/layout/detail-card";
import { useProductDelete } from "@/components/products/product-delete-action";
import { ProductDetailGallery } from "@/components/products/detail/product-detail-gallery";
import { ProductFact } from "@/components/products/detail/product-fact";
import { ProductBarcodePrint } from "@/components/products/detail/product-barcode-print";
import { StatusBadge } from "@/components/products/status-badge";
import { IncompleteBadge } from "@/components/products/incomplete-badge";
import { NumberedBadge } from "@/components/products/numbered-badge";
import { VariantList } from "@/components/products/variant-list";
import { ProductListError, ProductListLoading } from "@/components/products/product-list-states";
import { PendingChangeBadge } from "@/components/change-requests/pending-change-badge";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const { data: product, isLoading, isError, error, refetch } = useProductQuery(params.id);
  const { data: settings } = useSettingsQuery();
  const currency = settings?.currency ?? "ILS";
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <PageContainer>
      {isLoading ? (
        <ProductListLoading />
      ) : notFound || !product ? (
        <EmptyState
          data-testid="product-not-found"
          icon="package"
          title="products.detail.notFoundTitle"
          hint="products.detail.notFoundDescription"
        />
      ) : isError ? (
        <ProductListError error={error} onRetry={() => void refetch()} />
      ) : (
        <ProductDetail product={product} currency={currency} locale={locale} />
      )}
    </PageContainer>
  );
}

function ProductDetail({ product, currency, locale }: { product: Product; currency: string; locale: string }) {
  const t = useTranslations("products.detail");
  const { user } = useSession();
  // This page only shows; everything editable (photos included) lives behind Edit, gated per field there (rule 5).
  const canEditDetails = can(user, "product.edit");
  const { canDelete, requestDelete, dialog } = useProductDelete(product, locale);
  const name = localize(product.name, locale);
  const description = localize(product.description, locale);
  const photos = useMemo(() => buildGalleryPhotos(product, locale), [product, locale]);
  const totalStock = product.hasVariants
    ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
    : (product.stock ?? 0);
  const pending = (field: (typeof CHANGE_REQUEST_FIELDS)[keyof typeof CHANGE_REQUEST_FIELDS]) => (
    <PendingChangeBadge
      changes={product.pendingChanges}
      entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
      entityId={product.id}
      field={field}
    />
  );

  return (
    <div className="flex flex-col gap-5" data-test-selector="product-detail">
      {dialog}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20">
          <ProductDetailGallery photos={photos} name={name} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <header
            data-test-selector="product-header"
            className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {product.category && <Badge tone="info">{localize(product.category.name, locale)}</Badge>}
                <StatusBadge isActive={product.isActive} />
                {/* Quick-sold and incomplete (rule 23): without the badge its blanks read as a broken record. */}
                {product.needsCompleting && <IncompleteBadge />}
                {product.isNumbered && <NumberedBadge count={product.variants.length} />}
                {pending(CHANGE_REQUEST_FIELDS.PRODUCT_IS_ACTIVE)}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canEditDetails && (
                  <Link
                    href={`/products/${product.id}/edit`}
                    data-test-selector="product-edit"
                    className={buttonClassName({ variant: "secondary" })}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    {t("edit")}
                  </Link>
                )}
                {canDelete && (
                  <RowMenu size="target" label={t("actions")} data-testid="product-actions">
                    <MenuItem icon="trash" tone="danger" data-testid="product-delete" onSelect={requestDelete}>
                      {t("delete.action")}
                    </MenuItem>
                  </RowMenu>
                )}
              </div>
            </div>

            <Typography variant="h1" className="text-primary-900" data-test-selector="product-name">
              {name}
            </Typography>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" data-test-selector="product-price">
              <Typography as="span" variant="display" className="tabular-nums text-ink">
                {formatMoney(product.basePrice, currency, locale)}
              </Typography>
              {product.compareAtPrice && (
                <Typography as="span" variant="body" tone="muted" className="tabular-nums line-through">
                  {formatMoney(product.compareAtPrice, currency, locale)}
                </Typography>
              )}
              {pending(CHANGE_REQUEST_FIELDS.PRODUCT_BASE_PRICE)}
            </div>

            <div className="flex flex-wrap items-center gap-2" data-test-selector="product-stock">
              <Badge tone={totalStock > 0 ? "success" : "danger"}>
                {totalStock > 0 ? t("inStock", { count: totalStock }) : t("outOfStock")}
              </Badge>
              {product.hasVariants && (
                <Typography as="span" variant="caption" tone="muted">
                  {t("variantsCount", { count: product.variants.length })}
                </Typography>
              )}
              {!product.hasVariants && pending(CHANGE_REQUEST_FIELDS.PRODUCT_STOCK)}
            </div>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line">
              {!product.hasVariants && (
                <ProductFact icon={Tag} label={t("sku")} testId="product-fact-sku">
                  <span dir="ltr" className="tabular-nums" {...SELECTABLE}>
                    {product.sku ?? "—"}
                  </span>
                </ProductFact>
              )}
              {/* A parent can carry one supplier code for every variant (rule 13). */}
              <ProductFact
                icon={Barcode}
                label={t("barcode")}
                testId="product-fact-barcode"
                action={<ProductBarcodePrint product={product} />}
              >
                <span className="flex flex-col items-start">
                  <span dir="ltr" className="tabular-nums" {...SELECTABLE}>
                    {product.barcode ?? "—"}
                  </span>
                  {product.barcode && (
                    <Typography as="span" variant="caption" tone="muted">
                      {product.barcodeSource === BARCODE_SOURCE.SUPPLIER ? t("barcodeSupplier") : t("barcodeGenerated")}
                    </Typography>
                  )}
                </span>
              </ProductFact>
              <ProductFact icon={Boxes} label={t("stock")} testId="product-fact-stock">
                <span className={totalStock <= 0 ? "font-medium text-danger-600" : undefined}>{totalStock}</span>
              </ProductFact>
              {/* Cost reaches this screen for an Admin only (rule 19). */}
              {product.cost && (
                <ProductFact icon={Coins} label={t("cost")} testId="product-fact-cost">
                  {formatMoney(product.cost, currency, locale)}
                </ProductFact>
              )}
            </dl>
          </header>

          {description && (
            <DetailCard icon={FileText} title={t("descriptionTitle")} data-testid="product-description">
              <Typography className="whitespace-pre-line">{description}</Typography>
            </DetailCard>
          )}
        </div>
      </div>

      {product.hasVariants && (
        <DetailCard
          icon={Layers}
          title={t("variantsTitle")}
          data-testid="product-variants"
          action={<TotalBadge total={product.variants.length} />}
        >
          {pending(CHANGE_REQUEST_FIELDS.PRODUCT_VARIANT_SET)}
          <VariantList variants={product.variants} variantTypes={product.variantTypes} currency={currency} />
        </DetailCard>
      )}
    </div>
  );
}

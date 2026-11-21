"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, Pencil } from "lucide-react";
import type { Product } from "@organza/shared/types/product";
import { BARCODE_SOURCE } from "@organza/shared/constants/barcode";
import { can } from "@organza/shared/lib/permissions";
import { Link } from "@/i18n/navigation";
import { useProductQuery } from "@/hooks/use-products";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useSession } from "@/components/providers/session-provider";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { buttonClassName, EmptyState } from "@store/ui";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProductGallery } from "@/components/products/product-gallery";
import { ProductDeleteAction } from "@/components/products/product-delete-action";
import {
  NumberedShawlPreview,
  hasPlacedShawlPoints,
} from "@/components/products/numbered-shawl/numbered-shawl-preview";
import { StatusBadge } from "@/components/products/status-badge";
import { IncompleteBadge } from "@/components/products/incomplete-badge";
import { VariantList } from "@/components/products/variant-list";
import { ProductListError, ProductListLoading } from "@/components/products/product-list-states";
import { PendingChangeBadge } from "@/components/change-requests/pending-change-badge";
import { CHANGE_REQUEST_ENTITIES, CHANGE_REQUEST_FIELDS } from "@organza/shared/constants/changeRequest";
import { SELECTABLE } from "@organza/shared/lib/nativeGestures";
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
    <PageContainer>
      {/* Above the header: the way out of the screen, not one of its actions. */}
      <Link
        href="/products"
        data-test-selector="back-link"
        className="mb-4 inline-flex w-fit items-center gap-1 text-label text-ink-muted transition-colors hover:text-primary-700"
      >
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("back")}
      </Link>

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
  const name = localize(product.name, locale);
  const description = localize(product.description, locale);
  const showCost = product.cost !== undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* A numbered shawl shows its points on the photo; anything else gets the gallery. */}
      {hasPlacedShawlPoints(product) ? (
        <NumberedShawlPreview product={product} />
      ) : (
        <ProductGallery images={product.images} alt={name} />
      )}

      <PageHeader
        name="product-detail"
        className="mb-0"
        title={name}
        description={product.category ? localize(product.category.name, locale) : undefined}
        actions={
          <>
            <StatusBadge isActive={product.isActive} />
            {/* Quick-sold and incomplete (rule 23): without the badge its blanks read as a broken record. */}
            {product.needsCompleting && <IncompleteBadge />}
            {/* A waiting change, shown to everybody so an Admin sees someone wants it hidden. */}
            <PendingChangeBadge
              changes={product.pendingChanges}
              entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
              entityId={product.id}
              field={CHANGE_REQUEST_FIELDS.PRODUCT_IS_ACTIVE}
            />
            {canEditDetails && (
              <Link
                href={`/products/${product.id}/edit`}
                data-test-selector="product-edit"
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                <Pencil className="size-4" aria-hidden="true" />
                {t("edit")}
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-heading font-semibold text-ink">{formatMoney(product.basePrice, currency, locale)}</span>
          {product.compareAtPrice && (
            <span className="text-label text-ink-muted line-through">
              {formatMoney(product.compareAtPrice, currency, locale)}
            </span>
          )}
          <PendingChangeBadge
            changes={product.pendingChanges}
            entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
            entityId={product.id}
            field={CHANGE_REQUEST_FIELDS.PRODUCT_BASE_PRICE}
          />
        </div>
        {showCost && product.cost && (
          <p className="text-label text-ink-muted">
            {t("cost")}: {formatMoney(product.cost, currency, locale)}
          </p>
        )}
      </div>

      {/* Outside the simple-product block: a parent can carry one supplier code for every variant (rule 13). */}
      <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-surface p-4 text-label shadow-card">
        <div>
          <dt className="text-ink-muted">{t("barcode")}</dt>
          {/* Selectable on purpose: a barcode is worth copying out. */}
          <dd className="font-medium text-ink" dir="ltr" {...SELECTABLE}>
            {product.barcode ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t("barcodeSource")}</dt>
          <dd className="font-medium text-ink">
            {product.barcodeSource === BARCODE_SOURCE.SUPPLIER ? t("barcodeSupplier") : t("barcodeGenerated")}
          </dd>
        </div>
      </dl>

      {!product.hasVariants && (
        <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-surface p-4 text-label shadow-card">
          <div>
            <dt className="text-ink-muted">{t("sku")}</dt>
            <dd className="font-medium text-ink" {...SELECTABLE}>
              {product.sku ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t("stock")}</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium text-ink">
              {product.stock ?? 0}
              <PendingChangeBadge
                changes={product.pendingChanges}
                entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
                entityId={product.id}
                field={CHANGE_REQUEST_FIELDS.PRODUCT_STOCK}
              />
            </dd>
          </div>
        </dl>
      )}

      {description && (
        <div>
          <h2 className="text-label font-medium text-ink">{t("descriptionTitle")}</h2>
          <p className="mt-1 text-label text-ink-muted">{description}</p>
        </div>
      )}

      {product.hasVariants && (
        <div>
          <h2 className="mb-2 flex flex-wrap items-center gap-2 text-label font-medium text-ink">
            {t("variantsTitle")} · {t("variantsCount", { count: product.variants.length })}
            <PendingChangeBadge
              changes={product.pendingChanges}
              entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
              entityId={product.id}
              field={CHANGE_REQUEST_FIELDS.PRODUCT_VARIANT_SET}
            />
          </h2>
          <VariantList variants={product.variants} variantTypes={product.variantTypes} currency={currency} />
        </div>
      )}

      <ProductDeleteAction product={product} />
    </div>
  );
}

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
import type { ReactNode } from "react";
import { Badge, buttonClassName, Card, EmptyState, MenuItem, RowMenu, TabPanel, Tabs, useTabParam } from "@store/ui";
import { PageContainer } from "@/components/layout/page-container";
import { ProductGallery } from "@/components/products/product-gallery";
import { useProductDelete } from "@/components/products/product-delete-action";
import { ProductImage } from "@/components/products/product-image";
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

const PRODUCT_TABS = ["variants", "photos", "description"] as const;
type ProductTab = (typeof PRODUCT_TABS)[number];

function ProductDetail({ product, currency, locale }: { product: Product; currency: string; locale: string }) {
  const t = useTranslations("products.detail");
  const { user } = useSession();
  // This page only shows; everything editable (photos included) lives behind Edit, gated per field there (rule 5).
  const canEditDetails = can(user, "product.edit");
  const { canDelete, requestDelete, dialog } = useProductDelete(product, locale);
  const name = localize(product.name, locale);
  const description = localize(product.description, locale);
  const tabs = PRODUCT_TABS.filter((id) => id !== "variants" || product.hasVariants);
  const [activeTab, setActiveTab] = useTabParam<ProductTab>("tab", tabs, tabs[0]!);
  const totalStock = product.hasVariants
    ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
    : (product.stock ?? 0);

  return (
    <div className="flex flex-col gap-5" data-test-selector="product-detail">
      {dialog}
      <header
        data-test-selector="product-header"
        className="rounded-card border border-line bg-surface p-4 shadow-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProductImage
              src={product.images[0]?.thumbnailUrl}
              alt={name}
              className="size-14 shrink-0 rounded-panel"
              sizes="56px"
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="truncate text-title font-medium text-primary-900" data-test-selector="product-name">
                {name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {product.category && <Badge tone="info">{localize(product.category.name, locale)}</Badge>}
                <StatusBadge isActive={product.isActive} />
                {/* Quick-sold and incomplete (rule 23): without the badge its blanks read as a broken record. */}
                {product.needsCompleting && <IncompleteBadge />}
                <PendingChangeBadge
                  changes={product.pendingChanges}
                  entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
                  entityId={product.id}
                  field={CHANGE_REQUEST_FIELDS.PRODUCT_IS_ACTIVE}
                />
              </div>
            </div>
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

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 lg:grid-cols-4">
          <Fact label={t("price")}>
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium text-ink">{formatMoney(product.basePrice, currency, locale)}</span>
              {product.compareAtPrice && (
                <span className="text-meta text-ink-muted line-through">
                  {formatMoney(product.compareAtPrice, currency, locale)}
                </span>
              )}
              <PendingChangeBadge
                changes={product.pendingChanges}
                entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
                entityId={product.id}
                field={CHANGE_REQUEST_FIELDS.PRODUCT_BASE_PRICE}
              />
            </span>
          </Fact>
          {/* Cost reaches this screen for an Admin only (rule 19). */}
          {product.cost && <Fact label={t("cost")}>{formatMoney(product.cost, currency, locale)}</Fact>}
          {!product.hasVariants && (
            <Fact label={t("sku")}>
              <span dir="ltr" className="tabular-nums" {...SELECTABLE}>
                {product.sku ?? "—"}
              </span>
            </Fact>
          )}
          {/* A parent can carry one supplier code for every variant (rule 13). */}
          <Fact label={t("barcode")}>
            <span className="flex flex-col">
              <span dir="ltr" className="tabular-nums" {...SELECTABLE}>
                {product.barcode ?? "—"}
              </span>
              {product.barcode && (
                <span className="text-meta text-ink-muted">
                  {product.barcodeSource === BARCODE_SOURCE.SUPPLIER ? t("barcodeSupplier") : t("barcodeGenerated")}
                </span>
              )}
            </span>
          </Fact>
          <Fact label={t("stock")}>
            <span className="flex flex-wrap items-center gap-2">
              <span className={totalStock <= 0 ? "font-medium text-danger-600" : undefined}>{totalStock}</span>
              {!product.hasVariants && (
                <PendingChangeBadge
                  changes={product.pendingChanges}
                  entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
                  entityId={product.id}
                  field={CHANGE_REQUEST_FIELDS.PRODUCT_STOCK}
                />
              )}
            </span>
          </Fact>
        </dl>
      </header>

      <Tabs
        data-testid="product-tabs"
        label="products.detail.tabs.label"
        value={activeTab}
        onChange={setActiveTab}
        tabs={tabs.map((id) => ({
          id,
          label: `products.detail.tabs.${id}`,
          ...(id === "variants" && { count: product.variants.length }),
        }))}
      />

      <TabPanel id={activeTab} data-testid="product-tab-panel">
        {activeTab === "variants" && (
          <div className="flex flex-col gap-3">
            <PendingChangeBadge
              changes={product.pendingChanges}
              entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
              entityId={product.id}
              field={CHANGE_REQUEST_FIELDS.PRODUCT_VARIANT_SET}
            />
            <VariantList variants={product.variants} variantTypes={product.variantTypes} currency={currency} />
          </div>
        )}

        {activeTab === "photos" &&
          (product.images.length === 0 ? (
            <EmptyState icon="image" title="products.detail.noPhotos" />
          ) : (
            <Card className="p-4">
              {hasPlacedShawlPoints(product) ? (
                <NumberedShawlPreview product={product} />
              ) : (
                <ProductGallery images={product.images} alt={name} />
              )}
            </Card>
          ))}

        {activeTab === "description" &&
          (description ? (
            <Card className="p-4">
              <p className="whitespace-pre-line text-value text-ink">{description}</p>
            </Card>
          ) : (
            <EmptyState icon="file" title="products.detail.noDescription" />
          ))}
      </TabPanel>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-value text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-value text-ink">{children}</dd>
    </div>
  );
}

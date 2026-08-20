"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, PackageX, Pencil } from "lucide-react";
import type { Product } from "@organza/shared/types/product";
import { BARCODE_SOURCE } from "@organza/shared/constants/barcode";
import { can } from "@organza/shared/lib/permissions";
import { Link } from "@/i18n/navigation";
import { useProductQuery } from "@/hooks/use-products";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useSession } from "@/components/providers/session-provider";
import { localize } from "@/lib/i18n-content";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
      {/* Above the header, not inside it: this is the way out of the screen,
          not one of its actions. */}
      <Link
        href="/products"
        className="mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground"
      >
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
    </PageContainer>
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

      {/* The product's own name is this screen's title, and its category the
          one line under it — so the page header sits below the photographs
          rather than above them, which is where the name has always been. */}
      <PageHeader
        name="product-detail"
        className="mb-0"
        title={name}
        description={product.category ? localize(product.category.name, locale) : undefined}
        actions={
          <>
            <StatusBadge isActive={product.isActive} />
            {/* Sold before it was entered, and still missing the half the
                cashier skipped (spec.md "Quick sell"). Said here as well as
                in the list, because this page is where somebody lands from a
                search and its blanks — no category under the title, no cost,
                no photograph — would otherwise read as a broken record. */}
            {product.needsCompleting && <IncompleteBadge />}
            {/* Their edit did not vanish — it is waiting (spec.md "Employee
                change approvals"). Shown to everybody, not just the person
                who asked: an Admin looking at the product should see that
                somebody wants it hidden. */}
            <PendingChangeBadge
              changes={product.pendingChanges}
              entityType={CHANGE_REQUEST_ENTITIES.PRODUCT}
              entityId={product.id}
              field={CHANGE_REQUEST_FIELDS.PRODUCT_IS_ACTIVE}
            />
            {canEditDetails && (
              <Button asChild variant="outline" size="sm" data-test-selector="product-edit">
                <Link href={`/products/${product.id}/edit`}>
                  <Pencil className="size-4" aria-hidden="true" />
                  {t("edit")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-semibold text-foreground">{formatMoney(product.basePrice, currency, locale)}</span>
          {product.compareAtPrice && (
            <span className="text-sm text-muted-foreground line-through">
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
          <p className="text-sm text-muted-foreground">
            {t("cost")}: {formatMoney(product.cost, currency, locale)}
          </p>
        )}
      </div>

      {/* The barcode stands on its own, outside the simple-product block: a
          product WITH variants can carry one too — a supplier's single code for
          every size, stuck on the parent — and scanning it in the POS opens the
          variant picker rather than selling anything. */}
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">{t("barcode")}</dt>
          {/* Long-pressable on purpose (globals.css "An app, not a page"):
              a barcode is one of the few strings here worth copying out. */}
          <dd className="font-medium text-foreground" dir="ltr" {...SELECTABLE}>
            {product.barcode ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("barcodeSource")}</dt>
          <dd className="font-medium text-foreground">
            {product.barcodeSource === BARCODE_SOURCE.SUPPLIER ? t("barcodeSupplier") : t("barcodeGenerated")}
          </dd>
        </div>
      </dl>

      {!product.hasVariants && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("sku")}</dt>
            <dd className="font-medium text-foreground" {...SELECTABLE}>
              {product.sku ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("stock")}</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium text-foreground">
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
          <h2 className="text-sm font-medium text-foreground">{t("descriptionTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      )}

      {product.hasVariants && (
        <div>
          <h2 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
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

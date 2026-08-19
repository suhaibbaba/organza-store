"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, PackageX } from "lucide-react";
import { can } from "@organza/shared/lib/permissions";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { useProductQuery } from "@/hooks/use-products";
import { ProductForm } from "@/components/products/product-form";
import { ProductListError, ProductListLoading } from "@/components/products/product-list-states";
import { ApiError } from "@/lib/api/errors";

// Reachable by every role: editing product/variant details is Admin +
// Manager only (CLAUDE.md rule 5), but "edit images" is a separate, broader
// capability Employees also have — ProductForm gates each section itself
// rather than blocking the whole screen.
export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("products.form");
  const { user } = useSession();
  const { data: product, isLoading, isError, error, refetch } = useProductQuery(params.id);

  const notFound = error instanceof ApiError && error.status === 404;
  const canEditDetails = can(user, "product.edit");

  return (
    <PageContainer>
      {/* Above the header, not inside it: this is the way out of the screen,
          not one of its actions. */}
      <Link
        href={`/products/${params.id}`}
        className="mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("back")}
      </Link>

      <PageHeader name="product-edit" title={canEditDetails ? t("editTitle") : t("images.manageTitle")} />

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <ProductListLoading />
        ) : notFound || !product ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <PackageX className="size-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">{t("notFoundTitle")}</p>
            </div>
          </div>
        ) : isError ? (
          <ProductListError error={error} onRetry={() => void refetch()} />
        ) : (
          // Remount whenever the variant set changes (e.g. after "add more
          // combinations") so local edit/removal state re-initializes from
          // the fresh list instead of going stale. Deliberately NOT keyed on
          // updatedAt: saving refetches the product, and remounting on that
          // would throw away the very thing the form is still holding — the
          // photos that failed to upload and the panel offering to retry them.
          <ProductForm key={`${product.id}:${product.variants.length}`} mode="edit" product={product} />
        )}
      </div>
    </PageContainer>
  );
}

"use client";

import { useState } from "react";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { useProductQuery } from "@/hooks/use-products";
import { ProductForm } from "@/components/products/product-form";
import { QuickSoldBanner } from "@/components/products/quick-sold-banner";
import { ProductListError, ProductListLoading } from "@/components/products/product-list-states";
import { ApiError } from "@/lib/api/errors";

// Every role reaches it (Employees may edit images); ProductForm gates each section itself (rule 5).
export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("products.form");
  const { user } = useSession();
  const { data: product, isLoading, isError, error, refetch } = useProductQuery(params.id);

  const notFound = error instanceof ApiError && error.status === 404;
  const canEditDetails = can(user, "product.edit");
  const [resets, setResets] = useState(0);

  return (
    <PageContainer>

      <PageHeader name="product-edit" title={canEditDetails ? t("editTitle") : t("images.manageTitle")} />

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <ProductListLoading />
        ) : notFound || !product ? (
          <EmptyState data-testid="product-not-found" icon="package" title="products.form.notFoundTitle" />
        ) : isError ? (
          <ProductListError error={error} onRetry={() => void refetch()} />
        ) : (
          <>
            {/* Quick-sold: the blanks below are deliberate and completing them is the errand (rule 23). */}
            <QuickSoldBanner product={product} />
            <ProductForm
              key={`${product.id}:${product.variants.length}:${resets}`}
              mode="edit"
              product={product}
              onDiscard={() => setResets((count) => count + 1)}
            />
          </>
        )}
      </div>
    </PageContainer>
  );
}

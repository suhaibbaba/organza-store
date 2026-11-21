"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
  const t = useTranslations("products.form");

  return (
    <PageContainer>

      <PageHeader name="product-new" title={t("createTitle")} />

      <ProductForm mode="create" />
    </PageContainer>
  );
}

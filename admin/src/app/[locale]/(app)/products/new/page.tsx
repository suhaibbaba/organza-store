"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
  const t = useTranslations("products.form");

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

      <PageHeader name="product-new" title={t("createTitle")} />

      <ProductForm mode="create" />
    </PageContainer>
  );
}

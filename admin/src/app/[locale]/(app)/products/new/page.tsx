"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
  const t = useTranslations("products.form");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/products" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("back")}
      </Link>

      <h1 className="text-xl font-semibold">{t("createTitle")}</h1>

      <ProductForm mode="create" />
    </div>
  );
}

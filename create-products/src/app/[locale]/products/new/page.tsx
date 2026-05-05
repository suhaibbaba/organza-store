"use client";
import { useLocale, useTranslations } from "next-intl";
import { sdk } from "@/lib/sdk";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProductForm } from "@/components/products/ProductForm";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function NewProductPage() {
  const locale = useLocale();
  const t = useTranslations("form");
  const tNav = useTranslations("nav");

  const handleSave = async (body: Record<string, unknown>) => {
    const result = await sdk.admin.product.create(body as Parameters<typeof sdk.admin.product.create>[0]);
    const product = (result as { product: { id: string } }).product;
    toast.success(t("createSuccess"));
    window.location.href = `/${locale}/products/${product.id}`;
  };

  return (
    <AppLayout title={tNav("products")}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}`} className="p-2 hover:bg-white rounded-xl transition-colors">
            <ArrowLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">{t("createProduct")}</h1>
        </div>
        <ProductForm onSave={handleSave} isCreate />
      </div>
    </AppLayout>
  );
}

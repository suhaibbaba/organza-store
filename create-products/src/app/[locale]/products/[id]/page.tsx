"use client";
import { use } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk, PRODUCT_FIELDS } from "@/lib/sdk";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProductForm } from "@/components/products/ProductForm";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const locale = useLocale();
  const t = useTranslations("form");
  const tNav = useTranslations("nav");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const result = await sdk.admin.product.retrieve(id, {
        fields: PRODUCT_FIELDS,
      } as Parameters<typeof sdk.admin.product.retrieve>[1]);
      return (result as { product: Record<string, unknown> }).product;
    },
  });

  const handleSave = async (body: Record<string, unknown>) => {
    console.log({ body });

    await sdk.admin.product.update(
      id,
      body as Parameters<typeof sdk.admin.product.update>[1],
    );
    toast.success(t("saveSuccess"));
    queryClient.invalidateQueries({ queryKey: ["product", id] });
  };

  return (
    <AppLayout title={tNav("products")}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}`}
            className="p-2 hover:bg-white rounded-xl transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">
            {t("saveChanges")}
          </h1>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm h-32 animate-pulse"
              />
            ))}
          </div>
        ) : data ? (
          <ProductForm product={data} onSave={handleSave} />
        ) : null}
      </div>
    </AppLayout>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { OrderBuilder } from "@/components/orders/new/order-builder";

export default function NewOrderPage() {
  const t = useTranslations("orders.new");

  return (
    // UI convenience only; the backend refuses the POST regardless (rule 5).
    <RoleGuard action="order.create">
      <PageContainer>

        <PageHeader name="order-new" title={t("title")} description={t("subtitle")} />

        <OrderBuilder />
      </PageContainer>
    </RoleGuard>
  );
}

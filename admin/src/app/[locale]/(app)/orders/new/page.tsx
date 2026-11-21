"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClassName } from "@store/ui";
import { OrderBuilder } from "@/components/orders/new/order-builder";

export default function NewOrderPage() {
  const t = useTranslations("orders.new");

  return (
    // UI convenience only; the backend refuses the POST regardless (rule 5).
    <RoleGuard action="order.create">
      <PageContainer>
        {/* Above the header: the way out of the screen, not one of its actions. */}
        <Link
          href="/orders"
          data-test-selector="back-link"
          className={buttonClassName({ variant: "quiet", className: "-ms-2 mb-4 self-start px-2" })}
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          {t("back")}
        </Link>

        <PageHeader name="order-new" title={t("title")} description={t("subtitle")} />

        <OrderBuilder />
      </PageContainer>
    </RoleGuard>
  );
}

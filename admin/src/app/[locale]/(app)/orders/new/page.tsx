"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { OrderBuilder } from "@/components/orders/new/order-builder";

export default function NewOrderPage() {
  const t = useTranslations("orders.new");

  return (
    // Client-side convenience only — the backend refuses the POST regardless
    // (CLAUDE.md rule 5). Every staff role can create an order, so in
    // practice this only catches a stale session.
    <RoleGuard action="order.create">
      <PageContainer>
        {/* Above the header, not inside it: this is the way out of the
            screen, not one of its actions. */}
        <Button asChild variant="ghost" size="sm" className="-ms-2 mb-4 self-start px-2">
          <Link href="/orders">
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>

        <PageHeader name="order-new" title={t("title")} description={t("subtitle")} />

        <OrderBuilder />
      </PageContainer>
    </RoleGuard>
  );
}

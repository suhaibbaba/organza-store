"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { Button } from "@/components/ui/button";
import { OrderBuilder } from "@/components/orders/new/order-builder";

export default function NewOrderPage() {
  const t = useTranslations("orders.new");

  return (
    // Client-side convenience only — the backend refuses the POST regardless
    // (CLAUDE.md rule 5). Every staff role can create an order, so in
    // practice this only catches a stale session.
    <RoleGuard action="order.create">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" size="sm" className="-ms-2 self-start px-2">
          <Link href="/orders">
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>

        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <OrderBuilder />
      </div>
    </RoleGuard>
  );
}

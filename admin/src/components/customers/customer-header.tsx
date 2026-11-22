"use client";

import { useTranslations } from "next-intl";
import { Coins, Package, Pencil, ReceiptText, UserRound, Wallet } from "lucide-react";
import { Badge, Button, PhoneLink, Typography, WhatsAppLink } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { useSession } from "@/components/providers/session-provider";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { cn } from "@/lib/utils";
import type { CustomerDetail } from "@/types/customer";

interface CustomerHeaderProps {
  customer: CustomerDetail;
  onEdit: () => void;
  onPay: () => void;
}

export function CustomerHeader({ customer, onEdit, onPay }: CustomerHeaderProps) {
  const t = useTranslations("customers.detail");
  const { user } = useSession();
  const formatMoney = useMoneyFormatter();
  const owing = Number(customer.balance) > 0;

  const facts = [
    { key: "balance", icon: Coins, label: t("balance"), value: formatMoney(customer.balance) },
    { key: "openOrders", icon: ReceiptText, label: t("openOrders"), value: String(customer.openOrderCount) },
    { key: "kept", icon: Package, label: t("keptPieces"), value: String(customer.keptPieceCount) },
    { key: "orders", icon: Wallet, label: t("orderCount"), value: String(customer.orderCount) },
  ];

  return (
    <header className="rounded-card border border-line bg-surface p-5 shadow-card" data-test-selector="customer-header">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-panel bg-primary-50 text-primary-700">
            <UserRound className="size-6" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <Typography variant="h1" weight="semibold" className="max-w-full truncate">
              {customer.name}
            </Typography>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <PhoneLink value={customer.phone} data-testid="customer-phone" />
              {customer.whatsapp && <WhatsAppLink value={customer.whatsapp} data-testid="customer-whatsapp" />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {owing ? (
                <Badge tone="danger" icon="clock">
                  {t("owingBadge")}
                </Badge>
              ) : (
                <Badge tone="success" icon="check">
                  {t("settledBadge")}
                </Badge>
              )}
              {customer.keptPieceCount > 0 && (
                <Badge tone="warning" icon="package">
                  {t("keptBadge", { count: customer.keptPieceCount })}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {can(user, "customer.manage") && (
            <Button
              variant="secondary"
              data-test-selector="customer-edit"
              icon={<Pencil className="size-4" aria-hidden="true" />}
              onClick={onEdit}
            >
              {t("edit")}
            </Button>
          )}
          {owing && can(user, "order.recordPayment") && (
            <Button
              data-test-selector="customer-record-payment"
              icon={<Wallet className="size-4" aria-hidden="true" />}
              onClick={onPay}
            >
              {t("recordPayment")}
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-sunken lg:grid-cols-4">
        {facts.map((fact, index) => {
          const isBalance = fact.key === "balance";
          return (
            <div
              key={fact.key}
              data-test-selector={`customer-fact-${fact.key}`}
              className={cn(
                "flex min-w-0 flex-col items-start gap-2 border-line px-4 py-3.5 sm:flex-row sm:gap-3 sm:px-5 sm:py-4",
                index % 2 === 1 && "border-s",
                index >= 2 && "border-t lg:border-t-0",
                index === 2 && "lg:border-s",
                isBalance && "bg-primary-50",
              )}
            >
              <fact.icon className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
              <div className="min-w-0">
                <Typography variant="small" tone="muted" as="dt">
                  {fact.label}
                </Typography>
                <Typography
                  as="dd"
                  variant={isBalance ? "h2" : "body"}
                  weight={isBalance ? "semibold" : undefined}
                  className={cn(
                    "mt-1 break-words tabular-nums",
                    isBalance && (owing ? "text-danger-700" : "text-primary-900"),
                  )}
                >
                  {fact.value}
                </Typography>
              </div>
            </div>
          );
        })}
      </dl>
      {customer.note && (
        <Typography variant="small" tone="muted" className="mt-3 break-words">
          {customer.note}
        </Typography>
      )}
    </header>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Coins, FileText, Pencil, Plus, ReceiptText, Store, Wallet } from "lucide-react";
import { Badge, Button, PhoneLink, Typography, WhatsAppLink } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { useSession } from "@/components/providers/session-provider";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { cn } from "@/lib/utils";
import type { SupplierDetail } from "@/types/supplier";

interface SupplierHeaderProps {
  supplier: SupplierDetail;
  onEdit: () => void;
  onAddInvoice: () => void;
  onPay: () => void;
}

export function SupplierHeader({ supplier, onEdit, onAddInvoice, onPay }: SupplierHeaderProps) {
  const t = useTranslations("suppliers.detail");
  const { user } = useSession();
  const formatMoney = useMoneyFormatter();
  const owing = Number(supplier.balance) > 0;
  const canManage = can(user, "supplier.manage");

  const facts = [
    { key: "balance", icon: Coins, label: t("balance"), value: formatMoney(supplier.balance) },
    { key: "openInvoices", icon: ReceiptText, label: t("openInvoices"), value: String(supplier.openInvoiceCount) },
    { key: "invoiced", icon: FileText, label: t("totalInvoiced"), value: formatMoney(supplier.totalInvoiced) },
    { key: "paid", icon: Wallet, label: t("totalPaid"), value: formatMoney(supplier.totalPaid) },
  ];

  return (
    <header className="rounded-card border border-line bg-surface p-5 shadow-card" data-test-selector="supplier-header">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-panel bg-primary-50 text-primary-700">
            <Store className="size-6" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <Typography variant="h1" weight="semibold" className="max-w-full truncate">
              {supplier.name}
            </Typography>
            {(supplier.phone || supplier.whatsapp) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {supplier.phone && <PhoneLink value={supplier.phone} data-testid="supplier-phone" />}
                {supplier.whatsapp && <WhatsAppLink value={supplier.whatsapp} data-testid="supplier-whatsapp" />}
              </div>
            )}
            {owing ? (
              <Badge tone="danger" icon="clock">
                {t("owingBadge")}
              </Badge>
            ) : (
              <Badge tone="success" icon="check">
                {t("settledBadge")}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canManage && (
            <Button
              variant="secondary"
              data-test-selector="supplier-edit"
              icon={<Pencil className="size-4" aria-hidden="true" />}
              onClick={onEdit}
            >
              {t("edit")}
            </Button>
          )}
          {canManage && (
            <Button
              variant={owing ? "secondary" : "primary"}
              data-test-selector="supplier-add-invoice"
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={onAddInvoice}
            >
              {t("addInvoice")}
            </Button>
          )}
          {owing && can(user, "supplier.pay") && (
            <Button
              data-test-selector="supplier-pay"
              icon={<Wallet className="size-4" aria-hidden="true" />}
              onClick={onPay}
            >
              {t("pay")}
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
              data-test-selector={`supplier-fact-${fact.key}`}
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
      {(supplier.address || supplier.note) && (
        <div className="mt-3 flex flex-col gap-1">
          {supplier.address && (
            <Typography variant="small" tone="muted" className="break-words">
              {supplier.address}
            </Typography>
          )}
          {supplier.note && (
            <Typography variant="small" tone="muted" className="break-words">
              {supplier.note}
            </Typography>
          )}
        </div>
      )}
    </header>
  );
}

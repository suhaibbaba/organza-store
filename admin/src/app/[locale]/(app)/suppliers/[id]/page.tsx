"use client";

import { use, useState } from "react";
import { EmptyState, Skeleton } from "@store/ui";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { OrderListError } from "@/components/orders/order-list-states";
import { RecordPaymentModal } from "@/components/customers/record-payment-modal";
import { SupplierHeader } from "@/components/suppliers/supplier-header";
import { SupplierInvoices, SupplierPayments } from "@/components/suppliers/supplier-sections";
import { SupplierFormModal } from "@/components/suppliers/supplier-form-modal";
import { SupplierInvoiceModal } from "@/components/suppliers/supplier-invoice-modal";
import { SupplierPaymentPreview } from "@/components/suppliers/supplier-payment-preview";
import { usePaySupplierMutation, useSupplierQuery } from "@/hooks/use-suppliers";
import { ApiError } from "@/lib/api/errors";
import type { SupplierInvoiceTarget, SupplierPaymentTarget } from "@/types/supplier";

export default function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RoleGuard action="supplier.view">
      <SupplierPageContent params={params} />
    </RoleGuard>
  );
}

function SupplierPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: supplier, isLoading, isError, error, refetch } = useSupplierQuery(id);
  const pay = usePaySupplierMutation(id);
  const [editing, setEditing] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState<SupplierInvoiceTarget | null>(null);
  const [paying, setPaying] = useState<SupplierPaymentTarget | null>(null);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-44 rounded-card" />
          <Skeleton className="h-56 rounded-card" />
        </div>
      </PageContainer>
    );
  }

  if (isError && !(error instanceof ApiError && error.code === ERROR_CODES.SUPPLIER_NOT_FOUND)) {
    return (
      <PageContainer>
        <OrderListError error={error} onRetry={() => void refetch()} />
      </PageContainer>
    );
  }

  if (!supplier) {
    return (
      <PageContainer>
        <EmptyState
          data-testid="supplier-not-found"
          icon="store"
          title="suppliers.detail.notFoundTitle"
          hint="suppliers.detail.notFoundHint"
        />
      </PageContainer>
    );
  }

  const payInvoice = paying?.invoice ?? null;

  return (
    <PageContainer>
      <div className="flex flex-col gap-5">
        <SupplierHeader
          supplier={supplier}
          onEdit={() => setEditing(true)}
          onAddInvoice={() => setInvoiceTarget({ mode: "create" })}
          onPay={() => setPaying({ invoice: null })}
        />
        <SupplierInvoices
          supplier={supplier}
          onEdit={(invoice) => setInvoiceTarget({ mode: "edit", invoice })}
          onPay={(invoice) => setPaying({ invoice })}
        />
        <SupplierPayments supplier={supplier} />
      </div>

      <SupplierFormModal target={editing ? { mode: "edit", supplier } : null} onClose={() => setEditing(false)} />
      <SupplierInvoiceModal supplierId={supplier.id} target={invoiceTarget} onClose={() => setInvoiceTarget(null)} />
      <RecordPaymentModal
        key={payInvoice?.id ?? "account"}
        open={paying !== null}
        onClose={() => setPaying(null)}
        balance={payInvoice ? payInvoice.balance : supplier.balance}
        title={payInvoice ? "suppliers.payment.invoiceTitle" : "suppliers.payment.title"}
        titleValues={{ name: supplier.name, invoice: payInvoice?.invoiceNumber ?? payInvoice?.invoiceDate ?? "" }}
        description={payInvoice ? "suppliers.payment.invoiceDescription" : "suppliers.payment.description"}
        namespace="suppliers.payment"
        drawerChoice
        onSave={(input) => pay.mutateAsync({ ...input, ...(payInvoice && { invoiceId: payInvoice.id }) })}
        renderPreview={(amount) => (
          <SupplierPaymentPreview supplierId={supplier.id} amount={amount} invoiceId={payInvoice?.id ?? null} />
        )}
      />
    </PageContainer>
  );
}

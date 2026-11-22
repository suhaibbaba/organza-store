"use client";

import { use, useState } from "react";
import { EmptyState, Skeleton } from "@store/ui";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { OrderListError } from "@/components/orders/order-list-states";
import { CustomerHeader } from "@/components/customers/customer-header";
import { CustomerKeptPieces, CustomerOrders, CustomerPayments } from "@/components/customers/customer-sections";
import { CustomerFormModal } from "@/components/customers/customer-form-modal";
import { CustomerPaymentPreview } from "@/components/customers/customer-payment-preview";
import { RecordPaymentModal } from "@/components/customers/record-payment-modal";
import { useCustomerQuery, usePayCustomerMutation } from "@/hooks/use-customers";
import { ApiError } from "@/lib/api/errors";

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RoleGuard action="customer.view">
      <CustomerPageContent params={params} />
    </RoleGuard>
  );
}

function CustomerPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: customer, isLoading, isError, error, refetch } = useCustomerQuery(id);
  const pay = usePayCustomerMutation(id);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

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

  if (isError && !(error instanceof ApiError && error.code === ERROR_CODES.CUSTOMER_NOT_FOUND)) {
    return (
      <PageContainer>
        <OrderListError error={error} onRetry={() => void refetch()} />
      </PageContainer>
    );
  }

  if (!customer) {
    return (
      <PageContainer>
        <EmptyState
          data-testid="customer-not-found"
          icon="users"
          title="customers.detail.notFoundTitle"
          hint="customers.detail.notFoundHint"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-5">
        <CustomerHeader customer={customer} onEdit={() => setEditing(true)} onPay={() => setPaying(true)} />
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <CustomerKeptPieces customer={customer} />
            <CustomerOrders customer={customer} />
          </div>
          <aside className="flex min-w-0 flex-col gap-4">
            <CustomerPayments customer={customer} />
          </aside>
        </div>
      </div>

      <CustomerFormModal target={editing ? { mode: "edit", customer } : null} onClose={() => setEditing(false)} />
      <RecordPaymentModal
        open={paying}
        onClose={() => setPaying(false)}
        balance={customer.balance}
        title="customers.payment.title"
        titleValues={{ name: customer.name }}
        description="customers.payment.description"
        onSave={(input) => pay.mutateAsync(input)}
        renderPreview={(amount) => <CustomerPaymentPreview customerId={customer.id} amount={amount} />}
      />
    </PageContainer>
  );
}

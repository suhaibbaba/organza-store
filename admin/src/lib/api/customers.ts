import type { CreateCustomerInput, CustomerPaymentInput, UpdateCustomerInput } from "@store/shared/schemas/customer";
import type { HandOverItemsInput, RecordPaymentInput } from "@store/shared/schemas/customer";
import type { Order } from "@store/shared/types/order";
import { apiFetch } from "@/lib/api/client";
import type {
  Customer,
  CustomerDetail,
  CustomerListFilters,
  CustomerListPage,
  CustomerPaymentResult,
  CustomerSummary,
} from "@/types/customer";

export async function fetchCustomers(filters: CustomerListFilters): Promise<CustomerListPage> {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  });
  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.owing) {
    params.set("owing", "true");
  }
  if (filters.keptPieces) {
    params.set("keptPieces", "true");
  }
  const { data, meta } = await apiFetch<CustomerSummary[]>(`/api/customers?${params.toString()}`);
  return { customers: data, meta: meta as CustomerListPage["meta"] };
}

export async function fetchCustomer(id: string): Promise<CustomerDetail> {
  const { data } = await apiFetch<CustomerDetail>(`/api/customers/${id}`);
  return data;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const { data } = await apiFetch<Customer>("/api/customers", { method: "POST", body: input });
  return data;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  const { data } = await apiFetch<Customer>(`/api/customers/${id}`, { method: "PATCH", body: input });
  return data;
}

export async function payCustomer(id: string, input: CustomerPaymentInput): Promise<CustomerPaymentResult> {
  const { data } = await apiFetch<CustomerPaymentResult>(`/api/customers/${id}/payments`, {
    method: "POST",
    body: input,
  });
  return data;
}

export async function recordOrderPayment(orderId: string, input: RecordPaymentInput): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${orderId}/payments`, { method: "POST", body: input });
  return data;
}

export async function handOverItems(orderId: string, input: HandOverItemsInput): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${orderId}/handover`, { method: "POST", body: input });
  return data;
}

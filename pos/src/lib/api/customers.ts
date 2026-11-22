import type { CreateCustomerInput } from "@store/shared/schemas/customer";
import type { Customer, CustomerSummary } from "@store/shared/types/customer";
import { apiFetch } from "@/lib/api/client";
import { CUSTOMER_SEARCH_PAGE_SIZE } from "@/constants/pos";

export async function searchCustomers(query: string): Promise<CustomerSummary[]> {
  const params = new URLSearchParams({ q: query, pageSize: String(CUSTOMER_SEARCH_PAGE_SIZE) });
  const { data } = await apiFetch<CustomerSummary[]>(`/api/customers?${params.toString()}`);
  return data;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const { data } = await apiFetch<Customer>("/api/customers", { method: "POST", body: input });
  return data;
}

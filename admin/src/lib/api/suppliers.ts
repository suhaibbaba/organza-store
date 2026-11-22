import type {
  CreateSupplierInput,
  CreateSupplierInvoiceInput,
  SupplierPaymentInput,
  UpdateSupplierInput,
  UpdateSupplierInvoiceInput,
} from "@store/shared/schemas/supplier";
import { apiFetch } from "@/lib/api/client";
import type {
  Supplier,
  SupplierDetail,
  SupplierInvoiceRow,
  SupplierListFilters,
  SupplierListPage,
  SupplierPaymentResult,
  SupplierSummary,
} from "@/types/supplier";

export async function fetchSuppliers(filters: SupplierListFilters): Promise<SupplierListPage> {
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
  const { data, meta } = await apiFetch<SupplierSummary[]>(`/api/suppliers?${params.toString()}`);
  return { suppliers: data, meta: meta as SupplierListPage["meta"] };
}

export async function fetchSupplier(id: string): Promise<SupplierDetail> {
  const { data } = await apiFetch<SupplierDetail>(`/api/suppliers/${id}`);
  return data;
}

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  const { data } = await apiFetch<Supplier>("/api/suppliers", { method: "POST", body: input });
  return data;
}

export async function updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
  const { data } = await apiFetch<Supplier>(`/api/suppliers/${id}`, { method: "PATCH", body: input });
  return data;
}

export async function createSupplierInvoice(
  supplierId: string,
  input: CreateSupplierInvoiceInput,
): Promise<SupplierInvoiceRow> {
  const { data } = await apiFetch<SupplierInvoiceRow>(`/api/suppliers/${supplierId}/invoices`, {
    method: "POST",
    body: input,
  });
  return data;
}

export async function updateSupplierInvoice(
  supplierId: string,
  invoiceId: string,
  input: UpdateSupplierInvoiceInput,
): Promise<SupplierInvoiceRow> {
  const { data } = await apiFetch<SupplierInvoiceRow>(`/api/suppliers/${supplierId}/invoices/${invoiceId}`, {
    method: "PATCH",
    body: input,
  });
  return data;
}

export async function deleteSupplierInvoice(supplierId: string, invoiceId: string): Promise<void> {
  await apiFetch(`/api/suppliers/${supplierId}/invoices/${invoiceId}`, { method: "DELETE" });
}

export async function paySupplier(id: string, input: SupplierPaymentInput): Promise<SupplierPaymentResult> {
  const { data } = await apiFetch<SupplierPaymentResult>(`/api/suppliers/${id}/payments`, {
    method: "POST",
    body: input,
  });
  return data;
}

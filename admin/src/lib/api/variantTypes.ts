import type { VariantType, VariantOptionValue } from "@shared/types/variant";
import type { CreateVariantTypeInput, AddOptionValueInput } from "@shared/schemas/variantType";
import { apiFetch } from "@/lib/api/client";

export async function fetchVariantTypes(): Promise<VariantType[]> {
  const { data } = await apiFetch<VariantType[]>("/api/variant-types");
  return data;
}

export async function createVariantType(input: CreateVariantTypeInput): Promise<VariantType> {
  const { data } = await apiFetch<VariantType>("/api/variant-types", { method: "POST", body: input });
  return data;
}

export async function addOptionValue(
  variantTypeId: string,
  input: AddOptionValueInput
): Promise<VariantOptionValue> {
  const { data } = await apiFetch<VariantOptionValue>(`/api/variant-types/${variantTypeId}/values`, {
    method: "POST",
    body: input,
  });
  return data;
}

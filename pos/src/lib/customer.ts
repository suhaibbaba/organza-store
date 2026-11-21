import type { CustomerSuggestion } from "@store/shared/types/order";
import type { OrderCustomerDraft } from "@/types/customer";
import type { OrderCustomerFormValues } from "@/lib/validation/customer";

// Optional fields are omitted, not sent empty: the schema rejects "" for a present key.
export function toCustomerFields(customer: OrderCustomerDraft) {
  const latitude = customer.latitude.trim();
  const longitude = customer.longitude.trim();
  // Half a coordinate points nowhere: both or neither.
  const hasLocation = latitude !== "" && longitude !== "";

  return {
    customerName: customer.name.trim(),
    customerPhone: customer.phone.trim(),
    ...(customer.whatsapp.trim() ? { customerWhatsapp: customer.whatsapp.trim() } : {}),
    ...(customer.address.trim() ? { customerAddress: customer.address.trim() } : {}),
    ...(customer.note.trim() ? { note: customer.note.trim() } : {}),
    ...(hasLocation ? { customerLatitude: Number(latitude), customerLongitude: Number(longitude) } : {}),
  };
}

// The phone goes in as stored, on its own prefix (rule 18); the note belongs to this order, so it stays.
export function suggestionToFormValues(
  suggestion: CustomerSuggestion,
  current: OrderCustomerFormValues,
): OrderCustomerFormValues {
  return {
    ...current,
    name: suggestion.name ?? "",
    phone: suggestion.phone,
    whatsapp: suggestion.whatsapp ?? "",
    address: suggestion.address ?? "",
    latitude: suggestion.latitude === null ? "" : String(suggestion.latitude),
    longitude: suggestion.longitude === null ? "" : String(suggestion.longitude),
  };
}

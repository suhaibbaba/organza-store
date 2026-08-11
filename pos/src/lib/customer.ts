import type { CustomerSuggestion } from "@organza/shared/types/order";
import type { OrderCustomerDraft } from "@/types/customer";
import type { OrderCustomerFormValues } from "@/lib/validation/customer";

// Shaping between the customer form, a tapped suggestion, and the order API.
// Mirrors admin/src/lib/order-draft.ts's customer half.

// The customer half of the create-order request. Optional fields are omitted
// rather than sent empty: the create schema requires a non-empty string when
// a key is present, so `""` would be a validation error where "not given" is
// fine. Name and phone are always sent — an online order must be deliverable
// back to someone (ORDER_CUSTOMER_REQUIRED).
export function toCustomerFields(customer: OrderCustomerDraft) {
  const latitude = customer.latitude.trim();
  const longitude = customer.longitude.trim();
  // Half a coordinate points nowhere, so the pair is sent together or not at
  // all (isLocationConsistent).
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

// Filling the form from a tapped suggestion. The phone goes in exactly as it
// was stored, on its own prefix (CLAUDE.md rule 18), and the note is left
// alone: it belongs to this order, not to the customer.
export function suggestionToFormValues(
  suggestion: CustomerSuggestion,
  current: OrderCustomerFormValues
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

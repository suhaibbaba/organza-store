// The customer half of a WhatsApp order taken at the counter. Snapshotted
// onto the order itself — there is no Customer entity yet (spec.md "Customer
// information") — so it is typed out per order rather than picked from a
// list, with the phone autocomplete standing in for the list the shop
// doesn't have.
export interface OrderCustomerDraft {
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  // Optional map pin, kept as typed text so a half-entered coordinate can sit
  // in the field without becoming a number.
  latitude: string;
  longitude: string;
  note: string;
}

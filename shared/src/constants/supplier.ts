// Suppliers and their invoices (spec.md "Suppliers and their invoices").
export const SUPPLIER_NAME_MAX_LENGTH = 120;
export const SUPPLIER_ADDRESS_MAX_LENGTH = 300;
export const SUPPLIER_NOTE_MAX_LENGTH = 500;
export const SUPPLIER_INVOICE_NUMBER_MAX_LENGTH = 60;
export const SUPPLIER_INVOICE_NOTE_MAX_LENGTH = 500;
export const SUPPLIER_PAYMENT_NOTE_MAX_LENGTH = 300;

export const SUPPLIER_SORT_FIELDS = ["name", "balance", "createdAt", "lastInvoiceAt"] as const;

// How many of a supplier's open invoices one payment may be spread over.
export const MAX_INVOICES_PER_SUPPLIER_PAYMENT = 200;
// Newest first on the supplier's page; older ones stay in the database.
export const SUPPLIER_DETAIL_INVOICE_LIMIT = 200;
export const SUPPLIER_DETAIL_PAYMENT_LIMIT = 200;

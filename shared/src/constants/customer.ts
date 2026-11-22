// Customers and credit sales (spec.md "Customers and selling on credit").
export const CUSTOMER_NAME_MAX_LENGTH = 120;
export const CUSTOMER_ADDRESS_MAX_LENGTH = 300;
export const CUSTOMER_NOTE_MAX_LENGTH = 500;
export const ORDER_PAYMENT_NOTE_MAX_LENGTH = 300;

export const CUSTOMER_SORT_FIELDS = ["name", "balance", "createdAt", "lastOrderAt"] as const;

// How many of a customer's open orders one payment may be spread over.
export const MAX_ORDERS_PER_CUSTOMER_PAYMENT = 100;

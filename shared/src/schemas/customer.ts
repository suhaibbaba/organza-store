import { z } from "zod";
import { booleanInput, decimalInput, paginationSchema } from "@/schemas/common";
import { phoneSchema } from "@/schemas/phone";
import { ERROR_CODES } from "@/constants/errors";
import { LATITUDE_MAX, LATITUDE_MIN, LONGITUDE_MAX, LONGITUDE_MIN } from "@/constants/order";
import {
  CUSTOMER_ADDRESS_MAX_LENGTH,
  CUSTOMER_NAME_MAX_LENGTH,
  CUSTOMER_NOTE_MAX_LENGTH,
  CUSTOMER_SORT_FIELDS,
  ORDER_PAYMENT_NOTE_MAX_LENGTH,
} from "@/constants/customer";

const latitudeSchema = z.coerce
  .number()
  .min(LATITUDE_MIN, ERROR_CODES.ORDER_LOCATION_INVALID)
  .max(LATITUDE_MAX, ERROR_CODES.ORDER_LOCATION_INVALID);
const longitudeSchema = z.coerce
  .number()
  .min(LONGITUDE_MIN, ERROR_CODES.ORDER_LOCATION_INVALID)
  .max(LONGITUDE_MAX, ERROR_CODES.ORDER_LOCATION_INVALID);

const sameNullness = (value: { latitude?: number | null; longitude?: number | null }) =>
  (value.latitude === undefined || value.latitude === null) ===
  (value.longitude === undefined || value.longitude === null);

export const createCustomerSchema = z
  .object({
    name: z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED).max(CUSTOMER_NAME_MAX_LENGTH),
    phone: phoneSchema,
    whatsapp: phoneSchema.nullish(),
    address: z.string().trim().min(1).max(CUSTOMER_ADDRESS_MAX_LENGTH).nullish(),
    latitude: latitudeSchema.nullish(),
    longitude: longitudeSchema.nullish(),
    note: z.string().trim().min(1).max(CUSTOMER_NOTE_MAX_LENGTH).nullish(),
  })
  .refine(sameNullness, { message: ERROR_CODES.ORDER_LOCATION_INVALID });
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED).max(CUSTOMER_NAME_MAX_LENGTH).optional(),
    phone: phoneSchema.optional(),
    whatsapp: phoneSchema.nullish(),
    address: z.string().trim().min(1).max(CUSTOMER_ADDRESS_MAX_LENGTH).nullish(),
    latitude: latitudeSchema.nullish(),
    longitude: longitudeSchema.nullish(),
    note: z.string().trim().min(1).max(CUSTOMER_NOTE_MAX_LENGTH).nullish(),
  })
  .refine(sameNullness, { message: ERROR_CODES.ORDER_LOCATION_INVALID });
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const listCustomersQuerySchema = paginationSchema.extend({
  // Name or phone digits.
  q: z.string().trim().min(1).optional(),
  // Only customers who still owe something.
  owing: booleanInput.optional(),
  // Only customers with a piece still kept in the shop for them.
  keptPieces: booleanInput.optional(),
  sortBy: z.enum(CUSTOMER_SORT_FIELDS).default("lastOrderAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

// A payment is a real, positive sum; a refund is never typed in, it follows a cancellation or return.
const paymentAmountSchema = decimalInput.refine((v) => Number(v) > 0, {
  message: ERROR_CODES.VALIDATION_INVALID_NUMBER,
});

export const recordPaymentSchema = z.object({
  amount: paymentAmountSchema,
  note: z.string().trim().min(1).max(ORDER_PAYMENT_NOTE_MAX_LENGTH).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// `preview` answers with the oldest-first split without saving it, so the screen can show it before Save.
export const customerPaymentSchema = recordPaymentSchema.extend({
  preview: booleanInput.optional(),
});
export type CustomerPaymentInput = z.infer<typeof customerPaymentSchema>;

export const handOverItemsSchema = z.object({
  itemIds: z.array(z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED)).min(1, ERROR_CODES.VALIDATION_REQUIRED),
});
export type HandOverItemsInput = z.infer<typeof handOverItemsSchema>;

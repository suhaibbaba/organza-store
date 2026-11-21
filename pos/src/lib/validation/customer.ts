import { z } from "zod";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { isValidE164 } from "@store/shared/lib/phone";
import { LATITUDE_MAX, LATITUDE_MIN, LONGITUDE_MAX, LONGITUDE_MIN } from "@store/shared/constants/order";
import { SIGNED_DECIMAL_REGEX } from "@/constants/numeric";
import type { OrderCustomerDraft } from "@/types/customer";

// Mirrors the admin's order-form validation; messages are backend error codes (rule 12).

// Signed and fractional, so it can't reuse the money rules; empty is fine, the pin is optional.
function isCoordinate(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  if (trimmed === "") {
    return true;
  }
  if (!SIGNED_DECIMAL_REGEX.test(trimmed)) {
    return false;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

// A WhatsApp order must be deliverable, as the backend's ORDER_CUSTOMER_REQUIRED enforces.
export const orderCustomerFormSchema = z
  .object({
    name: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
    phone: z.string().refine(isValidE164, { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
    whatsapp: z
      .string()
      .refine((v) => v.trim() === "" || isValidE164(v), { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
    address: z.string(),
    latitude: z.string().refine((v) => isCoordinate(v, LATITUDE_MIN, LATITUDE_MAX), {
      message: ERROR_CODES.ORDER_LOCATION_INVALID,
    }),
    longitude: z.string().refine((v) => isCoordinate(v, LONGITUDE_MIN, LONGITUDE_MAX), {
      message: ERROR_CODES.ORDER_LOCATION_INVALID,
    }),
    note: z.string(),
  })
  // Half a coordinate points nowhere: both or neither (as the backend's isLocationConsistent).
  .refine((v) => (v.latitude.trim() === "") === (v.longitude.trim() === ""), {
    message: ERROR_CODES.ORDER_LOCATION_INVALID,
    path: ["longitude"],
  });

export type OrderCustomerFormValues = z.infer<typeof orderCustomerFormSchema>;

export const DEFAULT_ORDER_CUSTOMER_VALUES: OrderCustomerFormValues = {
  name: "",
  phone: "",
  whatsapp: "",
  address: "",
  latitude: "",
  longitude: "",
  note: "",
};

export function toCustomerDraft(values: OrderCustomerFormValues): OrderCustomerDraft {
  return { ...values };
}

// A WhatsApp location arrives as one "32.313, 35.028" string, so pasting it fills both fields.
export function splitCoordinatePair(value: string): { latitude: string; longitude: string } | null {
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 2) {
    return null;
  }
  if (parts.some((part) => part === "" || !SIGNED_DECIMAL_REGEX.test(part))) {
    return null;
  }
  return { latitude: parts[0], longitude: parts[1] };
}

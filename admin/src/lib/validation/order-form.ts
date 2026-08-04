import { z } from "zod";
import { ERROR_CODES } from "@shared/constants/errors";
import { isValidE164 } from "@shared/lib/phone";
import { LATITUDE_MAX, LATITUDE_MIN, LONGITUDE_MAX, LONGITUDE_MIN } from "@shared/constants/order";
import { SIGNED_DECIMAL_REGEX } from "@/constants/numeric";
import type { OrderCustomerDraft } from "@/types/order";

// A coordinate is signed and fractional, so it can't reuse the
// non-negative-decimal rules the money/quantity fields share. Empty is fine —
// the map pin is optional (spec.md "Customer information").
function isCoordinate(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (!SIGNED_DECIMAL_REGEX.test(trimmed)) return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

// The customer half of a manually entered online order. Field messages are
// backend error codes (CLAUDE.md rule 12), same as every other form, so one
// translator renders both client- and server-side failures.
//
// Name and phone are required because an order taken over WhatsApp has to be
// deliverable back to someone — the same invariant the backend enforces with
// ORDER_CUSTOMER_REQUIRED.
export const orderCustomerFormSchema = z
  .object({
    name: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
    phone: z.string().refine(isValidE164, { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
    whatsapp: z
      .string()
      .refine((v) => v.trim() === "" || isValidE164(v), { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
    address: z.string(),
    latitude: z
      .string()
      .refine((v) => isCoordinate(v, LATITUDE_MIN, LATITUDE_MAX), {
        message: ERROR_CODES.ORDER_LOCATION_INVALID,
      }),
    longitude: z
      .string()
      .refine((v) => isCoordinate(v, LONGITUDE_MIN, LONGITUDE_MAX), {
        message: ERROR_CODES.ORDER_LOCATION_INVALID,
      }),
    note: z.string(),
  })
  // Half a coordinate points nowhere, so the pair is given together or not at
  // all (the backend's isLocationConsistent says the same).
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

// The form's values are already the draft's shape — kept as a named
// conversion so the two can diverge later without hunting down call sites.
export function toCustomerDraft(values: OrderCustomerFormValues): OrderCustomerDraft {
  return { ...values };
}

// A location shared over WhatsApp arrives as one "32.313, 35.028" string, so
// pasting it into the latitude field fills both rather than being rejected as
// a bad number. Returns null when there is no pair to split.
export function splitCoordinatePair(value: string): { latitude: string; longitude: string } | null {
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 2) return null;
  if (parts.some((part) => part === "" || !SIGNED_DECIMAL_REGEX.test(part))) return null;
  return { latitude: parts[0], longitude: parts[1] };
}

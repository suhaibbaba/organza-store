import { z } from "zod";
import { ERROR_CODES } from "@shared/constants/errors";
import { QUANTITY_MAX, QUANTITY_MIN, clampQuantity } from "@shared/constants/quantity";
import { DECIMAL_STRING_REGEX, INTEGER_STRING_REGEX } from "@/constants/numeric";

// Stock/quantities: integers only — no decimals, negatives, or letters.
export function isNonNegativeIntegerString(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && INTEGER_STRING_REGEX.test(trimmed);
}

// A quantity field's stored string read back as the number a stepper shows.
// A value that isn't a plain integer — empty, or half-deleted mid-edit —
// reads as the field's floor rather than NaN, and anything outside the range
// is clamped into it, so a stored 1200 is displayed as the 999 it will be
// saved as instead of a number no button can reach.
export function parseQuantity(value: string | undefined, min = QUANTITY_MIN, max = QUANTITY_MAX): number {
  if (value === undefined || !isNonNegativeIntegerString(value)) return clampQuantity(0, min, max);
  return clampQuantity(Number(value), min, max);
}

// Prices: decimals allowed, still no negatives or letters.
export function isNonNegativeDecimalString(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== "." && DECIMAL_STRING_REGEX.test(trimmed);
}

export const requiredIntegerField = z
  .string()
  .min(1, ERROR_CODES.VALIDATION_REQUIRED)
  .refine(isNonNegativeIntegerString, { message: ERROR_CODES.VALIDATION_INVALID_NUMBER });

export const optionalIntegerField = z
  .string()
  .refine((v) => v.trim() === "" || isNonNegativeIntegerString(v), { message: ERROR_CODES.VALIDATION_INVALID_NUMBER });

export const requiredDecimalField = z
  .string()
  .min(1, ERROR_CODES.VALIDATION_REQUIRED)
  .refine(isNonNegativeDecimalString, { message: ERROR_CODES.VALIDATION_INVALID_NUMBER });

export const optionalDecimalField = z
  .string()
  .refine((v) => v.trim() === "" || isNonNegativeDecimalString(v), { message: ERROR_CODES.VALIDATION_INVALID_NUMBER });

// Fields that measure something real and therefore have a ceiling (label
// geometry in millimetres, how many labels fit across a sheet). The bounds
// mirror the shared schema the backend validates with, so the user gets a
// plain message on the spot instead of a rejected save.
function isWithin(min: number, max: number) {
  return (value: string) => {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed >= min && parsed <= max;
  };
}

export function boundedIntegerField(min: number, max: number) {
  return requiredIntegerField.refine(isWithin(min, max), { message: ERROR_CODES.VALIDATION_OUT_OF_RANGE });
}

export function boundedDecimalField(min: number, max: number) {
  return requiredDecimalField.refine(isWithin(min, max), { message: ERROR_CODES.VALIDATION_OUT_OF_RANGE });
}

import { z } from "zod";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { QUANTITY_MAX, QUANTITY_MIN, clampQuantity } from "@store/shared/constants/quantity";
import { DECIMAL_STRING_REGEX, INTEGER_STRING_REGEX } from "@/constants/numeric";

// Stock/quantities: integers only — no decimals, negatives, or letters.
export function isNonNegativeIntegerString(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && INTEGER_STRING_REGEX.test(trimmed);
}

// Non-integers read as the floor, never NaN, and out-of-range is clamped to what will be saved.
export function parseQuantity(value: string | undefined, min = QUANTITY_MIN, max = QUANTITY_MAX): number {
  if (value === undefined || !isNonNegativeIntegerString(value)) {
    return clampQuantity(0, min, max);
  }
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

// Bounds mirror the shared schema, so the message comes before a rejected save.
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

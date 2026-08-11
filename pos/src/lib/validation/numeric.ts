import { z } from "zod";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { DECIMAL_STRING_REGEX, INTEGER_STRING_REGEX } from "@/constants/numeric";

// Stock/quantities: integers only — no decimals, negatives, or letters.
export function isNonNegativeIntegerString(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && INTEGER_STRING_REGEX.test(trimmed);
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

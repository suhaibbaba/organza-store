import { z } from "zod";
import { isValidE164 } from "@/lib/phone";
import { ERROR_CODES } from "@/constants/errors";

export const phoneSchema = z.string().refine(isValidE164, ERROR_CODES.VALIDATION_INVALID_PHONE);

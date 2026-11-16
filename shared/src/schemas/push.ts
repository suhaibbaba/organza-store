import { z } from "zod";
import { PUSH_LIMITS } from "@/constants/push";
import { SUPPORTED_LANGUAGES } from "@/constants/languages";
import { ERROR_CODES } from "@/constants/errors";

// A PushSubscription as the browser hands it over (endpoint + the two keys
// it generated). We never mint these values ourselves, so validation here is
// only about shape and size.
export const pushSubscribeSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .min(1, ERROR_CODES.VALIDATION_REQUIRED)
    .max(PUSH_LIMITS.maxEndpointLength)
    // A push endpoint is always an https URL served by the browser vendor's
    // push service — anything else is not something we should be posting to.
    .refine((value) => /^https:\/\//i.test(value), { message: ERROR_CODES.PUSH_ENDPOINT_INVALID }),
  keys: z.object({
    p256dh: z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED).max(PUSH_LIMITS.maxKeyLength),
    auth: z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED).max(PUSH_LIMITS.maxKeyLength),
  }),
  // Which language to render notifications for this device in. Optional: an
  // unknown or absent locale just falls back to the store default.
  locale: z.enum(SUPPORTED_LANGUAGES).optional(),
  userAgent: z.string().trim().max(PUSH_LIMITS.maxUserAgentLength).optional(),
});
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;

// Unsubscribing identifies the device by the same endpoint it registered.
export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED).max(PUSH_LIMITS.maxEndpointLength),
});
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;

import { z } from "zod";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { PASSWORD_MIN_LENGTH } from "@organza/shared/constants/validation";
import { isValidE164 } from "@organza/shared/lib/phone";
import type { Profile } from "@organza/shared/types/profile";
import type { UpdateProfileInput } from "@organza/shared/schemas/profile";
import { PROFILE_PASSWORD_MISMATCH } from "@/constants/profile";

export const profileFormSchema = z.object({
  name: z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  phone: z.string().refine(isValidE164, { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
  whatsapp: z.string().refine((v) => v.trim() === "" || isValidE164(v), { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function profileToFormValues(profile: Profile): ProfileFormValues {
  return { name: profile.name, phone: profile.phone, whatsapp: profile.whatsapp ?? "" };
}

export function toProfilePayload(values: ProfileFormValues): UpdateProfileInput {
  return { name: values.name.trim(), phone: values.phone, whatsapp: values.whatsapp.trim() ? values.whatsapp : null };
}

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT),
    confirm: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  })
  .refine((values) => values.newPassword === values.confirm, { path: ["confirm"], message: PROFILE_PASSWORD_MISMATCH });
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

export const EMPTY_PASSWORD_CHANGE: PasswordChangeValues = { currentPassword: "", newPassword: "", confirm: "" };

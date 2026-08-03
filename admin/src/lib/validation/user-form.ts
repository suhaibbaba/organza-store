import { z } from "zod";
import { ERROR_CODES } from "@shared/constants/errors";
import { ROLES } from "@shared/constants/roles";
import { PASSWORD_MIN_LENGTH } from "@shared/constants/validation";
import { isValidE164 } from "@shared/lib/phone";
import type { User } from "@shared/types/user";
import type { CreateUserInput, UpdateUserInput } from "@shared/schemas/user";

// Field messages are backend error codes (CLAUDE.md rule 12), same as every
// other form. Password stays optional at the schema level in both modes —
// "required on create" is enforced manually in the form's submit handler,
// since a create-only requirement isn't expressible without swapping
// resolvers mid-lifecycle for the same mounted sheet (see UserFormSheet).
export const userFormSchema = z.object({
  name: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
  password: z
    .string()
    .refine((v) => v.trim() === "" || v.length >= PASSWORD_MIN_LENGTH, { message: ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT }),
  role: z.enum(ROLES),
  phone: z.string().refine(isValidE164, { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
  whatsapp: z.string().refine((v) => v.trim() === "" || isValidE164(v), { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
  idNumber: z.string(),
});
export type UserFormValues = z.infer<typeof userFormSchema>;

export const DEFAULT_USER_FORM_VALUES: UserFormValues = {
  name: "",
  email: "",
  password: "",
  role: "EMPLOYEE",
  phone: "",
  whatsapp: "",
  idNumber: "",
};

export function userToFormValues(user: User): UserFormValues {
  return {
    name: user.name,
    email: user.email,
    password: "",
    role: user.role,
    phone: user.phone,
    whatsapp: user.whatsapp ?? "",
    idNumber: user.idNumber ?? "",
  };
}

export function toCreatePayload(values: UserFormValues): CreateUserInput {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    password: values.password,
    role: values.role,
    phone: values.phone,
    whatsapp: values.whatsapp.trim() ? values.whatsapp : undefined,
    idNumber: values.idNumber.trim() ? values.idNumber.trim() : undefined,
  };
}

// idNumber is only included when the caller can see/edit it (CLAUDE.md rule
// 19) — omitting the key leaves the stored value untouched, since the
// backend treats a missing field as "no change" (see updateUserSchema).
export function toUpdatePayload(values: UserFormValues, canEditSensitive: boolean): UpdateUserInput {
  return {
    name: values.name.trim(),
    role: values.role,
    phone: values.phone,
    whatsapp: values.whatsapp.trim() ? values.whatsapp : null,
    ...(canEditSensitive ? { idNumber: values.idNumber.trim() ? values.idNumber.trim() : null } : {}),
    ...(values.password.trim() ? { password: values.password } : {}),
  };
}

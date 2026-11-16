import { z } from "zod";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { ROLES } from "@organza/shared/constants/roles";
import { PASSWORD_MIN_LENGTH } from "@organza/shared/constants/validation";
import { isValidE164 } from "@organza/shared/lib/phone";
import type { User } from "@organza/shared/types/user";
import type { CreateUserInput, UpdateUserInput } from "@organza/shared/schemas/user";

// Field messages are backend error codes (CLAUDE.md rule 12), same as every
// other form.
//
// Password is optional in BOTH modes now, and blank is the normal answer on
// create: the new member of staff is emailed a single-use link and chooses
// their own, so nobody at the counter ever types (or knows) somebody else's
// password. Typing one anyway is still supported — the fallback for a person
// whose mailbox is unreachable.
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
    // Omitted when blank — the backend then creates the account with no
    // password at all and emails a set-password link.
    ...(values.password.trim() ? { password: values.password } : {}),
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

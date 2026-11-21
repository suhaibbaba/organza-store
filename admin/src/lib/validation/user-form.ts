import { z } from "zod";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { ROLES } from "@store/shared/constants/roles";
import { PASSWORD_MIN_LENGTH } from "@store/shared/constants/validation";
import { isValidE164 } from "@store/shared/lib/phone";
import type { User } from "@store/shared/types/user";
import type { CreateUserInput, UpdateUserInput } from "@store/shared/schemas/user";

// Blank is normal on create (they are emailed a link); a typed one is the fallback for an unreachable mailbox.
export const userFormSchema = z.object({
  name: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
  password: z.string().refine((v) => v.trim() === "" || v.length >= PASSWORD_MIN_LENGTH, {
    message: ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT,
  }),
  role: z.enum(ROLES),
  phone: z.string().refine(isValidE164, { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
  whatsapp: z
    .string()
    .refine((v) => v.trim() === "" || isValidE164(v), { message: ERROR_CODES.VALIDATION_INVALID_PHONE }),
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
    // Omitted when blank: the account gets no password and a set-password email.
    ...(values.password.trim() ? { password: values.password } : {}),
    role: values.role,
    phone: values.phone,
    whatsapp: values.whatsapp.trim() ? values.whatsapp : undefined,
    idNumber: values.idNumber.trim() ? values.idNumber.trim() : undefined,
  };
}

// idNumber only when the caller may edit it (rule 19); a missing key means no change.
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

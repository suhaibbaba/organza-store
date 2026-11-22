import { z } from "zod";
import { PASSCODE_LENGTH } from "@/constants/posLock";
import { ERROR_CODES } from "@/constants/errors";

export const passcodeSchema = z
  .string()
  .regex(new RegExp(`^\\d{${PASSCODE_LENGTH}}$`), { message: ERROR_CODES.VALIDATION_PASSCODE_FORMAT });

// What a tablet proves itself with: its id and the secret only it holds.
export const posDeviceCredentialsSchema = z.object({
  deviceId: z.string().min(1).max(64),
  deviceSecret: z.string().min(1).max(128),
});
export type PosDeviceCredentialsInput = z.infer<typeof posDeviceCredentialsSchema>;

// Joining a device right after a password sign-in; no credentials means "this tablet is new".
export const enrollPosDeviceSchema = posDeviceCredentialsSchema.partial();
export type EnrollPosDeviceInput = z.infer<typeof enrollPosDeviceSchema>;

export const setPasscodeSchema = z.object({ passcode: passcodeSchema });
export type SetPasscodeInput = z.infer<typeof setPasscodeSchema>;

export const unlockPosDeviceSchema = posDeviceCredentialsSchema.extend({
  userId: z.string().min(1).max(64),
  passcode: passcodeSchema,
});
export type UnlockPosDeviceInput = z.infer<typeof unlockPosDeviceSchema>;

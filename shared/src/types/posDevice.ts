import type { Role } from "@/types/role";

// The answer to joining a device; the secret is sent once, when the device is new.
export interface PosDeviceEnrollment {
  deviceId: string;
  deviceSecret: string | null;
  hasPasscode: boolean;
}

// One person on a device's lock screen.
export interface PosDeviceMemberSummary {
  userId: string;
  name: string;
  role: Role;
  // Too many wrong passcodes: this person must sign in with their password.
  locked: boolean;
}

export interface PosUnlockResult {
  token: string;
}

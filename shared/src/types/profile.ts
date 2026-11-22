import type { Role } from "@/types/role";
import type { SupportedLanguage } from "@/types/language";

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
  whatsapp: string | null;
  // null: no choice made yet, so each device keeps its own.
  locale: SupportedLanguage | null;
  createdAt: string;
}

export interface ProfileSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}

// A sign-in passkey on the person's own account; `provider` is the password manager or platform when the device says so.
export interface ProfilePasskey {
  id: string;
  name: string | null;
  provider: string | null;
  // Synced across the person's devices (iCloud Keychain, Google Password Manager) or kept on one.
  synced: boolean;
  createdAt: string | null;
}

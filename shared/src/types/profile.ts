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

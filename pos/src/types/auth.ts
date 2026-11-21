import type { Role } from "@organza/shared/types/role";
import type { SupportedLanguage } from "@organza/shared/types/language";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  // The language chosen on the profile, applied when this person signs in.
  locale?: SupportedLanguage | null;
}

export interface Session {
  user: SessionUser;
  token: string;
}

import type { Role } from "@store/shared/types/role";
import type { SupportedLanguage } from "@store/shared/types/language";

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

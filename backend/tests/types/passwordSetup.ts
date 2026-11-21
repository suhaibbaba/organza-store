import type { PasswordTokenPurpose } from "@store/shared/constants/passwordSetup";
import type { SerializableUser } from "@/types";

/** A staff row plus hasPassword, which tells "invited" from "signed in"; both are isActive. */
export interface StaffAccountView extends SerializableUser {
  hasPassword: boolean;
  /** Whether this account has ever done anything — see lib/userHistory.ts. */
  hasHistory: boolean;
}

/** POST /api/users/:id/password-reset */
export interface PasswordResetInvite {
  email: string;
  url: string;
  expiresAt: string;
}

/** POST /api/password-setup/verify */
export interface PasswordTokenCheck {
  email: string;
  name: string;
  purpose: PasswordTokenPurpose;
  expiresAt: string;
}

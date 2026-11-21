import type { ProfileSession } from "@organza/shared/types/profile";

export type DeviceKind = "phone" | "tablet" | "desktop" | "unknown";

export interface DeviceDescription {
  browser: string | null;
  system: string | null;
  kind: DeviceKind;
}

export interface DeviceRowProps {
  session: ProfileSession;
  onSignOut: (session: ProfileSession) => void;
}

export interface PasswordChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

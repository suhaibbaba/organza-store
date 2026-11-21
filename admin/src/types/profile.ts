import type { ProfileSession } from "@store/shared/types/profile";

export type DeviceKind = "phone" | "tablet" | "desktop" | "unknown";

export interface DeviceDescription {
  browser: string | null;
  system: string | null;
  kind: DeviceKind;
}

export interface ProfileDevicesProps {
  sessions: ProfileSession[];
}

export interface PasswordChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

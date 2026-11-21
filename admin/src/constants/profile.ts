import type { IconName, SectionTone } from "@store/ui";
import { CHANGE_REQUEST_NOTIFICATION_ROLES } from "@organza/shared/constants/push";
import type { Role } from "@organza/shared/types/role";
import type { DeviceKind } from "@/types/profile";

export const PROFILE_HREF = "/profile";

// A full message key: the two new-password boxes are compared on the screen only.
export const PROFILE_PASSWORD_MISMATCH = "profile.password.mismatch";

export const PROFILE_SECTIONS = {
  details: { icon: "user", tone: "blue" },
  devices: { icon: "monitor", tone: "violet" },
  password: { icon: "lock", tone: "amber" },
  language: { icon: "language", tone: "green" },
  notifications: { icon: "bell", tone: "rose" },
} as const satisfies Record<string, { icon: IconName; tone: SectionTone }>;

// Sale and approval pushes are only ever sent to Admins, so nobody else is offered the switch.
export const NOTIFICATION_RECIPIENT_ROLES: readonly Role[] = CHANGE_REQUEST_NOTIFICATION_ROLES;

export const PROFILE_AVATAR_SIZE = 56;

// First match wins, so Edge and Opera come before Chrome, and Chrome before Safari.
export const USER_AGENT_BROWSERS: readonly { name: string; pattern: RegExp }[] = [
  { name: "Edge", pattern: /Edg(e|A|iOS)?\// },
  { name: "Opera", pattern: /OPR\/|Opera/ },
  { name: "Samsung Internet", pattern: /SamsungBrowser\// },
  { name: "Firefox", pattern: /Firefox\/|FxiOS\// },
  { name: "Chrome", pattern: /Chrome\/|CriOS\// },
  { name: "Safari", pattern: /Safari\// },
];

export const USER_AGENT_SYSTEMS: readonly { name: string; pattern: RegExp; kind: DeviceKind }[] = [
  { name: "iPad", pattern: /iPad/, kind: "tablet" },
  { name: "iPhone", pattern: /iPhone/, kind: "phone" },
  { name: "Android", pattern: /Android.*Mobile/, kind: "phone" },
  { name: "Android", pattern: /Android/, kind: "tablet" },
  { name: "Windows", pattern: /Windows/, kind: "desktop" },
  { name: "macOS", pattern: /Mac OS X|Macintosh/, kind: "desktop" },
  { name: "Linux", pattern: /Linux/, kind: "desktop" },
];

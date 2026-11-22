import type { BadgeTone, IconName, SectionTone } from "@store/ui";
import type { Role } from "@store/shared/types/role";
import type { DeviceKind } from "@/types/profile";

export const PROFILE_HREF = "/profile";
export const SELL_HREF = "/sell";

export const PROFILE_SECTIONS = {
  details: { icon: "user", tone: "blue" },
  devices: { icon: "monitor", tone: "violet" },
  password: { icon: "lock", tone: "amber" },
  passkeys: { icon: "passkey", tone: "green" },
  passcode: { icon: "key", tone: "violet" },
  language: { icon: "language", tone: "green" },
} as const satisfies Record<string, { icon: IconName; tone: SectionTone }>;

export const PROFILE_AVATAR_SIZE = 56;

export const ROLE_BADGE_TONES: Record<Role, BadgeTone> = {
  ADMIN: "info",
  MANAGER: "warning",
  EMPLOYEE: "neutral",
};

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

// The one client-only field message, for the second password box the backend never sees.
export const PASSWORD_MISMATCH_KEY = "profile.password.mismatch";

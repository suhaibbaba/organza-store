import { USER_AGENT_BROWSERS, USER_AGENT_SYSTEMS } from "@/constants/profile";
import type { DeviceDescription } from "@/types/profile";

// A label for a signed-in device; a best guess from the user-agent string, never used for any decision.
export function describeUserAgent(userAgent: string | null): DeviceDescription {
  if (!userAgent) {
    return { browser: null, system: null, kind: "unknown" };
  }
  const browser = USER_AGENT_BROWSERS.find((entry) => entry.pattern.test(userAgent))?.name ?? null;
  const system = USER_AGENT_SYSTEMS.find((entry) => entry.pattern.test(userAgent));
  return { browser, system: system?.name ?? null, kind: system?.kind ?? "unknown" };
}

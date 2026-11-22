import { POS_DEVICE_COOKIE, POS_DEVICE_COOKIE_MAX_AGE_SECONDS, POS_DEVICE_KEY } from "@/constants/storage";
import type { PosDeviceCredentials } from "@/types/auth";

export function getDeviceCredentials(): PosDeviceCredentials | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(POS_DEVICE_KEY) ?? "null") as PosDeviceCredentials | null;
    return stored?.deviceId && stored.deviceSecret ? stored : null;
  } catch {
    return null;
  }
}

export function setDeviceCredentials(credentials: PosDeviceCredentials): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(POS_DEVICE_KEY, JSON.stringify(credentials));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // Only says "this tablet has a lock screen"; the secret never leaves localStorage.
  document.cookie = `${POS_DEVICE_COOKIE}=1; path=/; max-age=${POS_DEVICE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

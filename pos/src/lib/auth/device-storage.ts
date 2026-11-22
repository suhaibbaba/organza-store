import { POS_DEVICE_COOKIE, POS_DEVICE_COOKIE_MAX_AGE_SECONDS, POS_DEVICE_KEY } from "@/constants/storage";
import type { PosDeviceCredentials } from "@/types/auth";

const DEVICE_CHANGED_EVENT = "store-pos-device-changed";

// For useSyncExternalStore: the server never knows the tablet, so the first paint matches and the real answer follows.
export function subscribeToDevice(onChange: () => void): () => void {
  window.addEventListener(DEVICE_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DEVICE_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function hasStoredDevice(): boolean {
  return getDeviceCredentials() !== null;
}

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
  window.dispatchEvent(new Event(DEVICE_CHANGED_EVENT));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // Only says "this tablet has a lock screen"; the secret never leaves localStorage.
  document.cookie = `${POS_DEVICE_COOKIE}=1; path=/; max-age=${POS_DEVICE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

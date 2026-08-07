import type { DeviceFlag } from "@/types/feedback";

// A yes/no preference that belongs to the phone rather than to the account —
// "is the beep on at this till", "does this till buzz". Remembered in
// localStorage and shaped for useSyncExternalStore, like the app's other
// browser-owned facts (lib/pwa.ts): read from where it actually lives rather
// than mirrored into React state, so there is nothing to set in an effect and
// nothing to go stale.
//
// Storage can throw outright — Safari in private mode, a locked-down kiosk
// profile — and a till that cannot remember a preference must still sell, so
// every path falls back to `false` rather than to an error. Both flags built
// on this read false as "not muted", which is the safe default: a cashier who
// can hear the beep knows the scan worked, and one who cannot is at worst
// where they were before they ever touched the switch.
export function createDeviceFlag(storageKey: string): DeviceFlag {
  const listeners = new Set<() => void>();
  // Read once and kept, because getSnapshot runs on every render.
  let cache: boolean | null = null;

  function readStorage(): boolean {
    try {
      return window.localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  }

  function handleStorageChange(event: StorageEvent) {
    // key === null is a whole-storage clear, which counts.
    if (event.key !== null && event.key !== storageKey) return;
    cache = readStorage();
    listeners.forEach((listener) => listener());
  }

  return {
    subscribe(onChange: () => void) {
      if (typeof window === "undefined") return () => {};
      listeners.add(onChange);
      // The same till can have the POS open in two tabs; muting in one should
      // not leave the other beeping.
      if (listeners.size === 1) window.addEventListener("storage", handleStorageChange);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) window.removeEventListener("storage", handleStorageChange);
      };
    },

    read() {
      if (typeof window === "undefined") return false;
      if (cache === null) cache = readStorage();
      return cache;
    },

    /** Server render: the markup has to match first paint, so assume "off". */
    readOnServer() {
      return false;
    },

    write(value: boolean) {
      cache = value;
      try {
        window.localStorage.setItem(storageKey, String(value));
      } catch {
        // Nothing to tell the cashier: the setting still holds for this tab,
        // it just won't survive a reload.
      }
      listeners.forEach((listener) => listener());
    },
  };
}

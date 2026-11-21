import type { DeviceFlag } from "@/types/feedback";

// A per-phone yes/no in localStorage, shaped for useSyncExternalStore.
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
    if (event.key !== null && event.key !== storageKey) {
      return;
    }
    cache = readStorage();
    listeners.forEach((listener) => listener());
  }

  return {
    subscribe(onChange: () => void) {
      if (typeof window === "undefined") {
        return () => {};
      }
      listeners.add(onChange);
      // Two tabs on one till: muting in one must silence the other too.
      if (listeners.size === 1) {
        window.addEventListener("storage", handleStorageChange);
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          window.removeEventListener("storage", handleStorageChange);
        }
      };
    },

    read() {
      if (typeof window === "undefined") {
        return false;
      }
      if (cache === null) {
        cache = readStorage();
      }
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
        // Storage unavailable: the setting holds for this tab and just won't survive a reload.
      }
      listeners.forEach((listener) => listener());
    },
  };
}

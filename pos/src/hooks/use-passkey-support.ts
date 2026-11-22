import { useSyncExternalStore } from "react";
import { passkeysSupported } from "@/lib/auth/passkey";

const noSubscription = () => () => undefined;

// False on the server and before hydration, so the passkey button never causes a hydration mismatch.
export function usePasskeySupport(): boolean {
  return useSyncExternalStore(noSubscription, passkeysSupported, () => false);
}

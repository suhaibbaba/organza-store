import { useSyncExternalStore } from "react";
import { isDesktopShell } from "@/lib/desktop";

const subscribeNever = () => () => {};

// The server never knows it is inside the desktop app, so the first paint matches and the answer follows.
export function useDesktopShell(): boolean {
  return useSyncExternalStore(subscribeNever, isDesktopShell, () => false);
}

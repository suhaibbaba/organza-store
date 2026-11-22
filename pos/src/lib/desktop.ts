import { isTauri } from "@tauri-apps/api/core";

// True only inside the Windows app (desktop/), never in a browser or the installed PWA.
export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && isTauri();
}

export async function minimizeDesktopWindow(): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

export async function closeDesktopWindow(): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

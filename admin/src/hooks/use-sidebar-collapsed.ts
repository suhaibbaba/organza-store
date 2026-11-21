"use client";

import { useSyncExternalStore } from "react";
import { SIDEBAR_COLLAPSED_EVENT, SIDEBAR_COLLAPSED_KEY } from "@/constants/storage";

let inMemory: boolean | null = null;

function read(): boolean {
  if (inMemory !== null) {
    return inMemory;
  }
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// A per-browser convenience: if storage is unavailable the sidebar simply opens expanded.
export function useSidebarCollapsed(): readonly [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);

  function setCollapsed(next: boolean) {
    inMemory = next;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch {
      // Storage blocked: the in-memory value still carries the choice for this visit.
    }
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
  }

  return [collapsed, setCollapsed] as const;
}

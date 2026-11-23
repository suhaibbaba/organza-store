"use client";

import { useSyncExternalStore } from "react";
import { COLLAPSED_SECTIONS_EVENT, COLLAPSED_SECTIONS_KEY } from "@/constants/storage";

let inMemory: Set<string> | null = null;

function readAll(): Set<string> {
  if (inMemory) {
    return inMemory;
  }
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(COLLAPSED_SECTIONS_KEY) ?? "[]");
    inMemory = new Set(Array.isArray(stored) ? stored.filter((name): name is string => typeof name === "string") : []);
  } catch {
    inMemory = new Set();
  }
  return inMemory;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === COLLAPSED_SECTIONS_KEY) {
      inMemory = null;
      onChange();
    }
  };
  window.addEventListener(COLLAPSED_SECTIONS_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(COLLAPSED_SECTIONS_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// Open by default; a section without a name folds for this visit only. Storage blocked ⇒ still works, unremembered.
export function useSectionCollapsed(name: string | undefined): readonly [boolean, (collapsed: boolean) => void] {
  const remembered = useSyncExternalStore(
    subscribe,
    () => (name ? readAll().has(name) : false),
    () => false,
  );

  function setCollapsed(next: boolean) {
    if (!name) {
      return;
    }
    const all = new Set(readAll());
    if (next) {
      all.add(name);
    } else {
      all.delete(name);
    }
    inMemory = all;
    try {
      window.localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...all]));
    } catch {
      // Storage blocked: the in-memory set still carries the choice for this visit.
    }
    window.dispatchEvent(new Event(COLLAPSED_SECTIONS_EVENT));
  }

  return [remembered, setCollapsed] as const;
}

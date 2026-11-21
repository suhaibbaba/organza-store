import { createContext, useContext } from "react";

const PageActionSlotContext = createContext<HTMLElement | null>(null);

export const PageActionSlotProvider = PageActionSlotContext.Provider;

export function usePageActionSlot(): HTMLElement | null {
  return useContext(PageActionSlotContext);
}

export function createPageActionSlot(): HTMLDivElement {
  const slot = document.createElement("div");

  slot.className = "flex items-center gap-2.5";

  return slot;
}

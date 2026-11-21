import type { JSX, ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePageActionSlot } from "@ui/lib/page-action-slot";

export function PageAction({ children }: { readonly children: ReactNode }): JSX.Element {
  const slot = usePageActionSlot();

  return slot === null ? <>{children}</> : createPortal(children, slot);
}

import { useEffect } from "react";

export function useReturnFocus(open: boolean): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    return () => {
      window.setTimeout(() => {
        const lost = document.activeElement === null || document.activeElement === document.body;

        if (lost && origin?.isConnected) {
          origin.focus({ preventScroll: true });
        }
      }, 0);
    };
  }, [open]);
}

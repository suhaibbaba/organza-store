import { useState, type KeyboardEvent } from "react";

export function openOnArrowDown(open: () => void) {
  return (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open();
    }
  };
}

export interface PickerOpener {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly focusOnOpen: boolean;
  opens(takeFocus: boolean): { onClick: () => void };
  show(): void;
}

export function usePickerOpen(): PickerOpener {
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState(true);

  const show = (takeFocus: boolean): void => {
    setFocusOnOpen(takeFocus);
    setOpen(true);
  };

  return {
    open,
    onOpenChange: setOpen,
    focusOnOpen,
    opens: (takeFocus) => ({
      onClick: () => {
        if (open) {
          setOpen(false);
          return;
        }

        show(takeFocus);
      },
    }),
    show: () => show(true),
  };
}

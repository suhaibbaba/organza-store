import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useEffect, useRef, useState, type JSX, type PointerEvent, type ReactNode } from "react";
import { useDialogLayer } from "@ui/components/dialog-layer";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface InfoTipProps extends TestIdProps {
  readonly label: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

const CLOSE_DELAY_MS = 150;

// Opens on hover or keyboard focus; a click or tap pins it until an outside click or Escape (operate-web's InfoHint).
export function InfoTip({ label, className, children, "data-testid": testId }: InfoTipProps): JSX.Element {
  const dialogLayer = useDialogLayer();
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const part = parts("info-tip", testId);

  useEffect(() => () => cancelClose(), []);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function hoverIn(event: PointerEvent) {
    if (event.pointerType === "mouse") {
      cancelClose();
      setOpen(true);
    }
  }

  function hoverOut(event: PointerEvent) {
    if (event.pointerType === "mouse" && !pinned.current) {
      cancelClose();
      closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          pinned.current = false;
        }
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          {...part()}
          aria-label={label}
          onPointerEnter={hoverIn}
          onPointerLeave={hoverOut}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            if (!pinned.current) {
              setOpen(false);
            }
          }}
          onClick={(event) => {
            event.preventDefault();
            pinned.current = true;
            cancelClose();
            setOpen(true);
          }}
          className={cn(
            "relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-pill",
            "text-ink-subtle transition-colors duration-150 hover:text-primary-700 data-[state=open]:text-primary-700",
            "after:absolute after:-inset-3 after:content-['']",
            "focus-visible:bg-neutral-300 focus-visible:text-ink",
            className,
          )}
        >
          <Icon name="info" className="size-4" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <PopoverPrimitive.Content
          {...part("content")}
          side="bottom"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          aria-label={label}
          onPointerEnter={hoverIn}
          onPointerLeave={hoverOut}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (triggerRef.current?.contains(event.target as Node)) {
              event.preventDefault();
            }
          }}
          className={cn(
            "z-50 w-65 max-w-(--radix-popover-content-available-width) rounded-card border border-line bg-surface p-3.5",
            "text-meta leading-relaxed font-normal text-ink shadow-float",
            "origin-(--radix-popover-content-transform-origin) data-[state=open]:animate-[menu-in_150ms_ease-out]",
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

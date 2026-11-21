import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useRef, useState, type JSX, type PointerEvent, type ReactNode } from "react";
import { useDialogLayer } from "@ui/components/dialog-layer";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface InfoTipProps extends TestIdProps {
  readonly label: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function InfoTip({
  label,
  className,
  children,
  "data-testid": testId,
}: InfoTipProps): JSX.Element {
  const dialogLayer = useDialogLayer();
  const [open, setOpen] = useState(false);
  const hovered = useRef(false);
  const part = parts("info-tip", testId);

  const hover = (next: boolean) => (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      hovered.current = next;
      setOpen(next);
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          {...part()}
          aria-label={label}
          onPointerEnter={hover(true)}
          onPointerLeave={hover(false)}
          onClick={(event) => {
            if (hovered.current) {
              event.preventDefault();
            }
          }}
          className={cn(
            "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-pill",
            "text-ink-subtle transition-colors duration-150 hover:text-ink",
            className,
          )}
        >
          <Icon name="info" className="size-4" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <PopoverPrimitive.Content
          {...part("content")}
          side="top"
          sideOffset={6}
          collisionPadding={12}
          aria-label={label}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => hovered.current && event.preventDefault()}
          className={cn(
            "z-50 max-w-(--field-max) rounded-control border border-line bg-surface px-3 py-2",
            "text-label font-normal text-ink shadow-float",
            "data-[state=open]:animate-[menu-in_150ms_ease-out]",
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

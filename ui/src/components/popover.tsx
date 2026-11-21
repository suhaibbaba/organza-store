import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useRef, type JSX, type ReactNode } from "react";
import { useDialogLayer } from "@ui/components/dialog-layer";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface PopoverProps extends TestIdProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly anchor: ReactNode;
  readonly title: string;
  readonly focusOnOpen?: boolean | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function Popover({
  open,
  onOpenChange,
  anchor,
  title,
  focusOnOpen = true,
  className,
  children,
  "data-testid": testId,
}: PopoverProps): JSX.Element {
  const dialogLayer = useDialogLayer();
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Anchor asChild ref={anchorRef}>
        {anchor}
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <PopoverPrimitive.Content
          {...parts("popover", testId)()}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label={title}
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node)) {
              event.preventDefault();
            }
          }}
          onOpenAutoFocus={(event: Event) => {
            if (!focusOnOpen) {
              event.preventDefault();
              return;
            }

            const content = event.currentTarget as HTMLElement | null;
            const start =
              content?.querySelector<HTMLElement>('[data-initial-focus="selected"]') ??
              content?.querySelector<HTMLElement>("[data-initial-focus]");

            if (start) {
              event.preventDefault();
              start.focus({ preventScroll: true });
            }
          }}
          className={cn(
            "z-50 max-h-[min(32rem,var(--radix-popover-content-available-height))] overflow-y-auto",
            "rounded-card border border-line bg-surface p-3 shadow-float",
            "origin-(--radix-popover-content-transform-origin)",
            "data-[state=open]:animate-[menu-in_150ms_ease-out]",
            "data-[state=closed]:animate-[menu-out_150ms_ease-in]",
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useState, type JSX, type ReactNode } from "react";
import { useDialogLayer } from "@ui/components/dialog-layer";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface InfoTipProps extends TestIdProps {
  readonly label: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function InfoTip({ label, className, children, "data-testid": testId }: InfoTipProps): JSX.Element {
  const dialogLayer = useDialogLayer();
  const [open, setOpen] = useState(false);
  const part = parts("info-tip", testId);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          {...part()}
          aria-label={label}
          // Toggled here, not by Radix: inside a link or a clickable card the click must not also follow it.
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((current) => !current);
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
          onOpenAutoFocus={(event) => event.preventDefault()}
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

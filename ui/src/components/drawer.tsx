import * as Dialog from "@radix-ui/react-dialog";
import { useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Icon } from "@ui/components/icon";
import { DialogLayerProvider } from "@ui/components/dialog-layer";
import { cn } from "@ui/lib/cn";
import { documentDirection } from "@ui/lib/direction";
import { useReturnFocus } from "@ui/lib/return-focus";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface DrawerProps extends TestIdProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  descriptionKey: string;
  children: ReactNode;
  footer?: ReactNode | undefined;
  // "start" for navigation opened from a start-side ☰ (the right edge in Arabic); content panels stay "end".
  side?: "start" | "end" | undefined;
  // "sm" leaves the page visible beside a navigation drawer.
  size?: "sm" | "md" | undefined;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  descriptionKey,
  children,
  footer,
  side = "end",
  size = "md",
  "data-testid": testId,
}: DrawerProps): JSX.Element {
  const { t } = useTranslation();
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  useReturnFocus(open);
  const part = parts("drawer", testId);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          {...part("overlay")}
          className={cn(
            "fixed inset-0 z-50 bg-ink/40",
            "data-[state=open]:animate-[fade-in_200ms_ease-out]",
            "data-[state=closed]:animate-[fade-out_150ms_ease-in]",
          )}
        />
        <Dialog.Content
          ref={setLayer}
          {...part()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
          }}
          tabIndex={-1}
          dir={documentDirection()}
          className={cn(
            "fixed inset-y-0 z-50 flex w-full flex-col border-line bg-surface shadow-float",
            size === "sm" ? "max-w-xs" : "max-w-md",
            side === "start"
              ? [
                  "start-0 border-e",
                  "data-[state=open]:animate-[drawer-in_220ms_cubic-bezier(0.32,0.72,0,1)]",
                  "data-[state=closed]:animate-[drawer-out_180ms_ease-in]",
                ]
              : [
                  "end-0 border-s",
                  "data-[state=open]:animate-[drawer-end-in_220ms_cubic-bezier(0.32,0.72,0,1)]",
                  "data-[state=closed]:animate-[drawer-end-out_180ms_ease-in]",
                ],
          )}
        >
          <div
            {...part("header")}
            className="flex items-start justify-between gap-3 border-b border-line px-4 py-3"
          >
            <Dialog.Title {...part("title")} className="text-section font-medium text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close
              {...part("close")}
              className={cn(
                "inline-flex size-(--control-h) shrink-0 cursor-pointer items-center justify-center rounded-pill",
                "text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink",
              )}
              aria-label={t("ui.common.close")}
            >
              <Icon name="x" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">{t(descriptionKey)}</Dialog.Description>

          <div {...part("body")} className="scroll-lane flex-1 overflow-y-auto px-4 py-4">
            <DialogLayerProvider container={layer}>{children}</DialogLayerProvider>
          </div>

          {footer && (
            <div
              {...part("footer")}
              className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3"
            >
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

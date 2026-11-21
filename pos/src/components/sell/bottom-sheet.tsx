"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Icon } from "@store/ui";
import { DialogLayerProvider } from "@store/ui/components/dialog-layer";
import { documentDirection } from "@store/ui/lib/direction";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Rendered as `pos-sheet-<name>`.
  name: string;
  // Already translated.
  title: ReactNode;
  description?: ReactNode;
  // A short form: full width under the thumb on a phone, a centred dialog from the small breakpoint.
  compact?: boolean;
  className?: string;
  headerClassName?: string;
  // Drawn before the title, e.g. the product photo in the variant picker.
  headerLeading?: ReactNode;
  children: ReactNode;
}

// The POS keeps its sheets rising from under the thumb; @store/ui's Drawer is a side panel only.
export function BottomSheet({
  open,
  onOpenChange,
  name,
  title,
  description,
  compact = false,
  className,
  headerClassName,
  headerLeading,
  children,
}: BottomSheetProps) {
  const t = useTranslations("common");
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-ink/40",
            "data-[state=open]:animate-[fade-in_200ms_ease-out]",
            "data-[state=closed]:animate-[fade-out_150ms_ease-in]"
          )}
        />
        <Dialog.Content
          ref={setLayer}
          dir={documentDirection()}
          // Focus the panel, not its first field: a phone would otherwise throw its keyboard open over the sheet.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
          }}
          tabIndex={-1}
          {...(description === undefined && { "aria-describedby": undefined })}
          data-test-selector={testSelectorFor("pos-sheet", name)}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-4 rounded-t-card border-t border-line bg-surface pb-[var(--safe-bottom)] shadow-float outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200",
            compact &&
              "sm:inset-0 sm:m-auto sm:h-fit sm:w-full sm:max-w-md sm:max-h-[85dvh] sm:rounded-card sm:border",
            className
          )}
        >
          <div className={cn("flex items-center gap-3 p-5 pe-16", headerClassName)}>
            {headerLeading}
            <div className="flex min-w-0 flex-col gap-1.5">
              <Dialog.Title className="text-heading font-semibold text-ink">{title}</Dialog.Title>
              {description !== undefined && (
                <Dialog.Description className="text-label text-ink-muted">{description}</Dialog.Description>
              )}
            </div>
          </div>

          <DialogLayerProvider container={layer}>{children}</DialogLayerProvider>

          <Dialog.Close
            aria-label={t("close")}
            data-test-selector={testSelectorFor("pos-sheet-close", name)}
            className={cn(
              "absolute end-3 top-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-control",
              "text-ink-muted transition-colors hover:bg-inset hover:text-ink",
              "focus-visible:bg-neutral-200 focus-visible:text-ink"
            )}
          >
            <Icon name="x" className="size-5" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

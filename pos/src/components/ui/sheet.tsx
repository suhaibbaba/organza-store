"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

interface SheetContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  // "bottom" is the POS default: everything the cashier is asked for
  // (variant, discount, quantity) rises from under the thumb rather than
  // from a screen edge two hands away. "start"/"end" are the writing-
  // direction edges (start = right in RTL), kept for anything drawer-like.
  side?: "bottom" | "start" | "end";
  closeLabel: string;
}

function SheetContent({
  className,
  children,
  side = "bottom",
  closeLabel,
  onOpenAutoFocus = focusPanelNotFirstField,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          // pb: iOS home indicator (CLAUDE.md "Mobile input & device
          // specifics") — every sheet ends in a bottom-anchored action row,
          // so this has to live on the shared root, not each call site.
          "fixed z-50 flex flex-col gap-4 border-border bg-background pb-[var(--safe-bottom)] shadow-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:duration-200 data-[state=open]:duration-300",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          // The slide direction must be logical (`start`/`end`), not physical
          // (`left`/`right`): the panel is pinned with a logical inset, so in
          // RTL a physical slide would fly it in from the opposite edge and
          // across the screen. tw-animate-css's *-start/*-end utilities flip
          // via :dir(), keeping the panel entering from the edge it sits on.
          side === "start" &&
            "inset-y-0 start-0 h-full w-5/6 max-w-sm border-e data-[state=closed]:slide-out-to-start data-[state=open]:slide-in-from-start",
          side === "end" &&
            "inset-y-0 end-0 h-full w-5/6 max-w-sm border-s data-[state=closed]:slide-out-to-end data-[state=open]:slide-in-from-end",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute end-3 top-3 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-5 pe-16", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

// Radix opens a dialog by focusing the first focusable thing inside it. When
// that thing is a text box, the phone throws its keyboard open over a screen
// nobody asked to type on — and on a POS that is half the sheet gone before
// the cashier has read it.
//
// This is every sheet's default `onOpenAutoFocus`: focus lands on the panel
// itself, so the focus trap and Escape still work, but no keyboard appears
// until someone actually taps a field. A sheet that genuinely wants a field
// focused has to say so by passing its own handler.
function focusPanelNotFirstField(event: Event) {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
